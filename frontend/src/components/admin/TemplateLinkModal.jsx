import React, { useState, useEffect } from 'react';
import api from '../../services/api';

export default function TemplateLinkModal({ template, isOpen, onClose, onLinked }) {
  const [vmIdInput, setVmIdInput] = useState('');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [previewing, setPreviewing] = useState(false);
  const [previewData, setPreviewData] = useState(null);

  useEffect(() => {
    if (isOpen) {
      setVmIdInput('');
      setTesting(false);
      setTestResult(null);
      setPreviewing(false);
      setPreviewData(null);
    }
  }, [isOpen]);

  if (!isOpen || !template) return null;

  const handleTestConnection = async () => {
    try {
      setTesting(true);
      setTestResult(null);
      const res = await api.post(`/vms/admin/templates/${template.id}/test-link/`, { proxmox_vm_id: vmIdInput });
      setTestResult(res.data);
    } catch (e) {
      setTestResult({
        success: false,
        message: e.response?.data?.message || 'Test failed'
      });
    } finally {
      setTesting(false);
    }
  };

  const handlePreview = async () => {
    try {
      setPreviewing(true);
      setPreviewData(null);
      const res = await api.post(`/vms/admin/templates/${template.id}/preview/`, { proxmox_vm_id: vmIdInput });
      setPreviewData(res.data);
      if (res.data.url) {
        window.open(res.data.url, '_blank', 'width=1024,height=768');
      }
    } catch (e) {
      setPreviewData({
        success: false,
        message: e.response?.data?.message || 'Preview failed'
      });
    } finally {
      setPreviewing(false);
    }
  };

  const handleConfirmLink = async () => {
    try {
      await api.post(`/vms/admin/templates/${template.id}/link/`, { proxmox_vm_id: vmIdInput });
      if (onLinked) onLinked();
    } catch (e) {
      alert(e.response?.data?.message || 'Failed to link');
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 60,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
    }}
    onClick={(e) => {
      if (e.target === e.currentTarget) onClose();
    }}>
      <div style={{
        background: 'var(--bg-card)', border: '1px solid var(--border-color)',
        borderRadius: '16px', width: '480px', maxWidth: '90vw',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 10px 10px -5px rgba(0, 0, 0, 0.2)',
        overflow: 'hidden',
      }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-color)' }}>
          <h3 style={{ color: 'var(--text-primary)', fontSize: '16px', fontWeight: 700 }}>
            Link {template.name} to Proxmox
          </h3>
        </div>
        
        <div style={{ padding: '24px' }}>
          <label style={{
            fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1.5px',
            color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: '8px',
          }}>
            Proxmox Template VM ID
          </label>
          <input 
            value={vmIdInput}
            onChange={e => setVmIdInput(e.target.value)}
            placeholder="e.g. 9002"
            style={{
              width: '100%', padding: '10px 14px', borderRadius: '10px',
              border: '1px solid var(--border-color)', background: 'var(--bg-input)',
              color: 'var(--text-primary)', fontSize: '14px', marginBottom: '16px',
            }}
          />
          
          <button onClick={handleTestConnection}
            disabled={!vmIdInput || testing}
            style={{
              width: '100%', padding: '10px', borderRadius: '10px',
              background: 'var(--status-info-bg)', color: 'var(--status-info)',
              border: '1px solid var(--status-info)', fontSize: '13px',
              fontWeight: 600, marginBottom: '16px', cursor: 'pointer',
            }}>
            {testing ? 'Testing...' : 'Test Connection'}
          </button>
          
          {testResult && (
            <div style={{
              padding: '14px', borderRadius: '10px',
              background: testResult.success ? 'var(--status-online-bg)' : 'var(--status-error-bg)',
              border: `1px solid ${testResult.success ? 'var(--status-online)' : 'var(--status-error)'}`,
              marginBottom: '16px',
            }}>
              {testResult.success ? (
                <>
                  <p style={{ color: 'var(--status-online)', fontSize: '13px', fontWeight: 600 }}>
                    ✓ VM Found: {testResult.name}
                  </p>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '12px', marginTop: '4px' }}>
                    {testResult.cores} cores, {Math.round(testResult.memory_mb / 1024)}GB RAM, Status: {testResult.status}
                  </p>
                  {testResult.warning && (
                    <p style={{ color: 'var(--status-warning)', fontSize: '11px', marginTop: '6px' }}>
                      ⚠ {testResult.warning}
                    </p>
                  )}
                </>
              ) : (
                <p style={{ color: 'var(--status-error)', fontSize: '13px' }}>
                  {testResult.message}
                </p>
              )}
            </div>
          )}
          
          {testResult?.success && (
            <button onClick={handlePreview}
              disabled={previewing}
              style={{
                width: '100%', padding: '10px', borderRadius: '10px',
                background: 'var(--bg-input)', color: 'var(--text-primary)',
                border: '1px solid var(--border-color)', fontSize: '13px',
                fontWeight: 600, marginBottom: '16px', cursor: previewing ? 'not-allowed' : 'pointer',
              }}>
              {previewing ? 'Starting Preview...' : 'Preview via Guacamole (Beta)'}
            </button>
          )}
          
          {previewData?.success && (
            <div style={{
              padding: '12px', borderRadius: '10px',
              background: 'var(--bg-input)', marginBottom: '16px',
              fontSize: '12px', color: 'var(--text-secondary)',
            }}>
              {previewData.message}
            </div>
          )}
        </div>
        
        <div style={{
          padding: '16px 24px', borderTop: '1px solid var(--border-color)',
          display: 'flex', gap: '12px', justifyContent: 'flex-end',
        }}>
          <button onClick={onClose}
            style={{
              padding: '10px 20px', borderRadius: '10px',
              background: 'var(--bg-input)', color: 'var(--text-secondary)',
              border: '1px solid var(--border-color)', fontSize: '13px', fontWeight: 600,
            }}>
            Cancel
          </button>
          <button onClick={handleConfirmLink}
            disabled={!testResult?.success}
            style={{
              padding: '10px 20px', borderRadius: '10px',
              background: 'var(--accent-primary)', color: '#FFFFFF', border: 'none',
              fontSize: '13px', fontWeight: 600, opacity: testResult?.success ? 1 : 0.4,
              boxShadow: '0 4px 6px -1px var(--accent-primary-soft)',
            }}>
            Confirm Link
          </button>
        </div>
      </div>
    </div>
  );
}
