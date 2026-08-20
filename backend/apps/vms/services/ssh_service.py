"""
Real SSH command execution against a guest VM, used by the template
creation wizard's apply-configuration/install-apps/finalize steps.

SSH (not the QEMU guest agent) is the right transport here: the guest
agent requires the qemu-guest-agent package to already be installed and
running inside the guest, which a genuinely fresh, just-installed-from-ISO
VM won't have yet — whereas SSH just needs an SSH server, which the OS
installer itself commonly offers to enable, and which the admin can also
enable by hand as part of finishing the manual OS-install step.

No step in here silently swallows a failure — every command's real exit
code, stdout, and stderr are always returned to the caller, which is
responsible for surfacing them honestly (job.log_step, error_message).
"""
import logging
import shlex
import paramiko

logger = logging.getLogger(__name__)

SSH_CONNECT_TIMEOUT_SECONDS = 15
SSH_COMMAND_TIMEOUT_SECONDS = 300


class SSHCommandError(Exception):
    """Raised when an SSH command genuinely fails (non-zero exit) and the
    caller asked for it to raise rather than just report."""

    def __init__(self, command, exit_code, stdout, stderr):
        self.command = command
        self.exit_code = exit_code
        self.stdout = stdout
        self.stderr = stderr
        super().__init__(
            f'SSH command failed (exit {exit_code}): {command}\nstderr: {stderr[:500]}'
        )


def run_ssh_command(host, username, password, command, timeout=SSH_COMMAND_TIMEOUT_SECONDS, raise_on_error=False):
    """
    Run one real command over SSH and return its real result.

    Args:
        host (str): The VM's real IP address.
        username (str): SSH username.
        password (str): SSH password.
        command (str): The real shell command to run.
        timeout (int): Max seconds to wait for the command to finish.
        raise_on_error (bool): If True, raise SSHCommandError on a
            non-zero exit code instead of just returning it.

    Returns:
        dict: {success, exit_code, stdout, stderr, error} — 'error' is
        only set for a genuine connection/transport failure (couldn't
        even reach the VM), never for a command that ran and failed.
    """
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    try:
        client.connect(
            hostname=host,
            username=username,
            password=password,
            timeout=SSH_CONNECT_TIMEOUT_SECONDS,
            banner_timeout=SSH_CONNECT_TIMEOUT_SECONDS,
            auth_timeout=SSH_CONNECT_TIMEOUT_SECONDS,
            look_for_keys=False,
            allow_agent=False,
        )
    except Exception as exc:
        logger.error("SSH connection to %s failed: %s", host, exc)
        return {
            'success': False,
            'exit_code': None,
            'stdout': '',
            'stderr': '',
            'error': f'Could not connect via SSH: {exc}',
        }

    try:
        # Every real caller of this (machine-id truncation, SSH host
        # key removal, shutdown, etc.) needs root, and the SSH login
        # account is a normal sudo-capable user, not root itself — so
        # route through the same `sudo -S bash -c` pattern
        # run_ssh_script uses (password on stdin, never as a command-
        # line argument where it'd leak into shell history/process
        # listings).
        stdin, stdout, stderr = client.exec_command("sudo -S -p '' bash -c " + shlex.quote(command), timeout=timeout)
        stdin.write(password + '\n')
        stdin.channel.shutdown_write()
        exit_code = stdout.channel.recv_exit_status()
        out = stdout.read().decode(errors='replace')
        err = stderr.read().decode(errors='replace')
    except Exception as exc:
        logger.error("SSH command execution failed on %s: %s", host, exc)
        client.close()
        return {
            'success': False,
            'exit_code': None,
            'stdout': '',
            'stderr': '',
            'error': f'SSH command execution failed: {exc}',
        }
    finally:
        client.close()

    result = {
        'success': exit_code == 0,
        'exit_code': exit_code,
        'stdout': out,
        'stderr': err,
        'error': None,
    }

    if exit_code != 0 and raise_on_error:
        raise SSHCommandError(command, exit_code, out, err)

    return result


def run_ssh_script(host, username, password, script, timeout=SSH_COMMAND_TIMEOUT_SECONDS):
    """
    Run a real, possibly multi-line shell script over SSH as root (via
    sudo -S with the same password, matching a standard Ubuntu/Zorin
    install where the first user account has sudo rights).

    Returns the same shape as run_ssh_command().
    """
    # Running `sudo -S bash -s` directly (NOT `echo password | sudo ...`)
    # lets a multi-line script with its own real comments/heredocs run
    # exactly as written, rather than escaping it into a single -c
    # string. Real, confirmed bug this replaced: piping via `echo
    # password | sudo -S bash -s` sends the password to `echo`'s
    # stdin — which `echo` never reads, since the password is its
    # *argument*, not input — while the SSH channel's stdin (where
    # `script` below gets written) is also `echo`'s stdin. So the
    # script was silently going nowhere: bash -s inherited stdin from
    # the pipe, saw EOF immediately after the password line, and ran
    # on an empty script — exiting 0 having done nothing. Writing the
    # password line THEN the script into ONE shared stdin lets `sudo
    # -S` consume the first line for its own prompt and hand the rest
    # straight through to bash.
    wrapped = "sudo -S -p '' bash -s"
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    try:
        client.connect(
            hostname=host,
            username=username,
            password=password,
            timeout=SSH_CONNECT_TIMEOUT_SECONDS,
            banner_timeout=SSH_CONNECT_TIMEOUT_SECONDS,
            auth_timeout=SSH_CONNECT_TIMEOUT_SECONDS,
            look_for_keys=False,
            allow_agent=False,
        )
    except Exception as exc:
        logger.error("SSH connection to %s failed: %s", host, exc)
        return {
            'success': False,
            'exit_code': None,
            'stdout': '',
            'stderr': '',
            'error': f'Could not connect via SSH: {exc}',
        }

    try:
        stdin, stdout, stderr = client.exec_command(wrapped, timeout=timeout)
        stdin.write(password + '\n')
        stdin.write(script)
        stdin.channel.shutdown_write()
        exit_code = stdout.channel.recv_exit_status()
        out = stdout.read().decode(errors='replace')
        err = stderr.read().decode(errors='replace')
    except Exception as exc:
        logger.error("SSH script execution failed on %s: %s", host, exc)
        client.close()
        return {
            'success': False,
            'exit_code': None,
            'stdout': '',
            'stderr': '',
            'error': f'SSH script execution failed: {exc}',
        }
    finally:
        client.close()

    return {
        'success': exit_code == 0,
        'exit_code': exit_code,
        'stdout': out,
        'stderr': err,
        'error': None,
    }
