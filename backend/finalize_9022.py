from apps.vms.models import VMTemplate

ubuntu = VMTemplate.objects.get(name='Ubuntu Desktop')
ubuntu.proxmox_template_id = 9022
ubuntu.software_list = ['Google Chrome', 'LibreOffice', 'Text Editor', 'Terminal']
ubuntu.save()
print('Ubuntu Desktop now points to 9022 with updated software list')
