import { useState, useEffect } from 'react';
import {
  Receipt, Clock, CreditCard, Download,
  CheckCircle, AlertCircle, XCircle,
  Monitor, Wallet, FileText, X
} from 'lucide-react';
import api from '../../services/api';

export default function BillingPanel({ isOpen, onClose }) {

  const [overview, setOverview] = useState(null);
  const [usage, setUsage] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('usage');
  const [downloading, setDownloading] = useState(null);
  const [receiptData, setReceiptData] = useState(null);
  const [receiptUrl, setReceiptUrl] = useState(null);



  useEffect(() => {
    // BillingPanel is always mounted by Layout.jsx (isOpen only toggles its
    // own visibility, it never unmounts) — so this effect used to run once
    // for the entire app session, on the very first render, regardless of
    // whether the panel had ever been opened. A payment or usage change
    // made after that first render would never show up, even after
    // closing and reopening. Re-fetch every time the panel actually opens.
    if (!isOpen) return;

    const fetchAll = async () => {
      try {
        setLoading(true);
        const [ovRes, usRes, pmRes] = await Promise.all([
          api.get('/billing/overview/'),
          api.get('/billing/usage/'),
          api.get('/billing/payments/'),
        ]);
        setOverview(ovRes.data);
        setUsage(ovRes.data?.items || usRes.data?.items || []);
        setPayments(pmRes.data?.payments || []);
      } catch(e) {
        console.error('Billing fetch:', e);
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, [isOpen]);

  const handleViewReceipt = async (paymentId) => {
    try {
      setDownloading(paymentId);
      const res = await api.get(`/billing/receipt/${paymentId}/`);
      setReceiptData(res.data?.receipt || res.data);
    } catch(e) {
      console.error('Receipt error:', e);
    } finally {
      setDownloading(null);
    }
  };

  const formatCurrency = (amount) => {
    return `TZS ${Number(amount || 0).toLocaleString()}`;
  };

  const formatDuration = (hours) => {
    if (!hours) return '0m';
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    if (h > 0 && m > 0) return `${h}h ${m}m`;
    if (h > 0) return `${h}h`;
    return `${m}m`;
  };

  if (!isOpen) return null;

  if (loading) {
    return (
      <>
        <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm" onClick={onClose} />
        <div className="fixed inset-0 z-[61] flex items-center justify-center pointer-events-none">
          <div className="w-8 h-8 border-2 border-[#0066FF]/30 border-t-[#0066FF] rounded-full animate-spin" />
        </div>
      </>
    );
  }

  return (
    <>
      <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-0 z-[61] flex items-center justify-center pointer-events-none">
        <div className="bg-sidebar border border-border rounded-2xl shadow-2xl shadow-black/50 w-[800px] max-w-[90vw] h-[600px] max-h-[85vh] flex flex-col overflow-hidden pointer-events-auto" style={{ animation: 'scaleIn 0.25s cubic-bezier(0.16, 1, 0.3, 1)' }}>
          
          {/* Header */}
          <div className="h-14 px-6 flex items-center justify-between border-b border-border-subtle flex-shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-[#6C63FF]/10 flex items-center justify-center">
                <Receipt size={16} className="text-[#6C63FF]" />
              </div>
              <div>
                <h2 className="text-base font-bold text-primary">Billing & Usage</h2>
                <p className="text-[10px] text-muted">
                  {new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                </p>
              </div>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-nav-hover text-secondary hover:text-primary active:scale-95 transition-all">
              <X size={18} />
            </button>
          </div>

          {/* Scrollable content */}
          <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
            <style>{`
              .billing-row:hover { background: rgba(255,255,255,0.02); }
              @keyframes downloadPulse {
                0% { transform: scale(1); }
                50% { transform: scale(1.1); }
                100% { transform: scale(1); }
              }
              @media print {
                body > *:not(.fixed) { display: none !important; }
                .fixed { position: static !important; background: white !important; }
                #receipt-container { box-shadow: none !important; }
              }
            `}</style>

      {/* Stat cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
        
        {/* Total Spent — all-time, across ALL payment types */}
        <div className="relative overflow-hidden bg-card/70 backdrop-blur-sm border border-border rounded-2xl p-5 group hover:border-border-strong transition-all">
          <div className="absolute top-0 right-0 w-24 h-24 bg-[#6C63FF]/5 rounded-full -translate-y-8 translate-x-8" />
          <div className="relative">
            <div className="flex items-center justify-between mb-4">
              <div className="w-10 h-10 rounded-xl bg-[#6C63FF]/10 flex items-center justify-center">
                <Wallet size={20} className="text-[#6C63FF]" />
              </div>
              <span className="text-[9px] uppercase tracking-widest text-faint font-medium">
                All Time
              </span>
            </div>
            <p className="text-2xl font-bold text-primary tracking-tight tabular-nums">
              {formatCurrency(overview?.this_month?.total_spent)}
            </p>
            <p className="text-[11px] text-muted mt-1">
              Total spent
              {(overview?.this_month?.this_month_spent ?? 0) > 0 && (
                <span className="ml-1 text-[#6C63FF]/70">
                  · {formatCurrency(overview.this_month.this_month_spent)} this month
                </span>
              )}
            </p>
          </div>
        </div>

        
        {/* Workspace free time remaining today */}
        <div className="relative overflow-hidden bg-card/70 backdrop-blur-sm border border-border rounded-2xl p-5 group hover:border-border-strong transition-all">
          <div className="absolute top-0 right-0 w-24 h-24 bg-[#00A3FF]/5 rounded-full -translate-y-8 translate-x-8" />
          <div className="relative">
            <div className="flex items-center justify-between mb-4">
              <div className="w-10 h-10 rounded-xl bg-[#00A3FF]/10 flex items-center justify-center">
                <Clock size={20} className="text-[#00A3FF]" />
              </div>
              <span className="text-[9px] uppercase tracking-widest text-faint font-medium">
                Today
              </span>
            </div>
            <p className="text-2xl font-bold text-primary tracking-tight tabular-nums">
              {overview?.workspace_subscription ? 'Unlimited' : `${overview?.workspace_free_minutes_remaining ?? 0}m`}
            </p>
            <p className="text-[11px] text-muted mt-1">
              {overview?.workspace_subscription ? 'Workspace subscription active' : 'Free workspace time remaining'}
            </p>
          </div>
        </div>

        {/* Workspace subscription status */}
        <div className="relative overflow-hidden bg-card/70 backdrop-blur-sm border border-border rounded-2xl p-5 group hover:border-border-strong transition-all">
          <div className="absolute top-0 right-0 w-24 h-24 bg-[#00FF87]/5 rounded-full -translate-y-8 translate-x-8" />
          <div className="relative">
            <div className="flex items-center justify-between mb-4">
              <div className="w-10 h-10 rounded-xl bg-[#00FF87]/10 flex items-center justify-center">
                <CreditCard size={20} className="text-[#00FF87]" />
              </div>
              <span className="text-[9px] uppercase tracking-widest text-faint font-medium">
                Workspace
              </span>
            </div>
            <p className="text-2xl font-bold text-primary tracking-tight tabular-nums">
              {overview?.workspace_subscription ? 'Active' : 'Pay-as-you-go'}
            </p>
            <p className="text-[11px] text-muted mt-1">
              {overview?.workspace_subscription
                ? `Renews ${new Date(overview.workspace_subscription.expires_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`
                : 'Subscribe for unlimited workspace access'}
            </p>
          </div>
        </div>
      </div>

      {/* Workspace subscription banner */}
      {overview?.workspace_subscription && (
        <div className="flex items-center gap-4 bg-card/70 border border-[#6C63FF]/20 rounded-2xl px-5 py-4 mb-8">
          <div className="w-10 h-10 rounded-xl bg-[#6C63FF]/10 flex items-center justify-center flex-shrink-0">
            <Monitor size={18} className="text-[#6C63FF]" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-primary">
                Workspace Unlimited
              </span>
              <span className="px-2 py-0.5 rounded-full bg-[#6C63FF]/10 text-[9px] font-bold text-[#6C63FF] uppercase tracking-wider">
                Active
              </span>
            </div>
            <span className="text-xs text-muted mt-0.5">
              Renews {new Date(overview.workspace_subscription.expires_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
            </span>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-2 scrollbar-hide">
        <button
          onClick={() => setActiveTab('usage')}
          className={`px-4 py-2 rounded-full text-xs font-semibold transition-all duration-200 active:scale-95 whitespace-nowrap
            ${activeTab === 'usage'
              ? 'bg-[#0066FF] text-white shadow-lg shadow-blue-500/30'
              : 'bg-card text-secondary border border-border hover:border-slate-600'
            }`}>
          Usage Details
          <span className="ml-1.5 text-[10px] opacity-60">
            ({usage.length})
          </span>
        </button>
        <button
          onClick={() => setActiveTab('payments')}
          className={`px-4 py-2 rounded-full text-xs font-semibold transition-all duration-200 active:scale-95 whitespace-nowrap
            ${activeTab === 'payments'
              ? 'bg-[#0066FF] text-white shadow-lg shadow-blue-500/30'
              : 'bg-card text-secondary border border-border hover:border-slate-600'
            }`}>
          Payment History
          <span className="ml-1.5 text-[10px] opacity-60">
            ({payments.length})
          </span>
        </button>
      </div>

      {/* Usage Details Tab */}
      {activeTab === 'usage' && (
        <div className="bg-card/70 backdrop-blur-sm border border-border rounded-2xl overflow-hidden overflow-x-auto">
          <div className="min-w-[800px]">
            {/* Table header */}
            <div className="grid grid-cols-[1fr_1.5fr_0.8fr_0.8fr_0.8fr] gap-4 px-5 py-3 border-b border-border-subtle">
              {['Date', 'Environment', 'Duration', 'Rate', 'Charge'].map(h => (
                <span key={h} className="text-[9px] uppercase tracking-widest text-muted font-semibold">
                  {h}
                </span>
              ))}
            </div>
            
            {/* Table rows */}
            {usage.length > 0 ? (
              usage.map((item, i) => (
                <div key={i} className={`grid grid-cols-[1fr_1.5fr_0.8fr_0.8fr_0.8fr] gap-4 px-5 py-4 border-b border-slate-800/20 billing-row transition-colors group`}>
                  
                  {/* Date */}
                  <div>
                    <p className="text-sm text-primary font-medium">
                      {new Date(item.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                    </p>
                    <p className="text-[10px] text-faint mt-0.5">
                      {item.time_range}
                    </p>
                  </div>
                  
                  {/* Environment */}
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-[#00A3FF]/10 flex items-center justify-center flex-shrink-0">
                      <Monitor size={13} className="text-[#00A3FF]" />
                    </div>
                    <div>
                      <p className="text-xs text-primary font-medium">
                        {item.template}
                      </p>
                      <p className="text-[10px] text-faint">
                        {item.template_specs}
                      </p>
                    </div>
                  </div>
                  
                  {/* Duration */}
                  <div className="flex items-center">
                    <span className="text-sm text-secondary tabular-nums">
                      {formatDuration(item.duration_hours)}
                    </span>
                  </div>
                  
                  {/* Rate */}
                  <div className="flex items-center">
                    <span className="text-xs text-muted tabular-nums">
                      {formatCurrency(item.price_per_hour)}/hr
                    </span>
                  </div>
                  
                  {/* Charge */}
                  <div className="flex items-center">
                    <span className={`text-sm font-semibold tabular-nums ${item.charge > 0 ? 'text-white' : 'text-[#00FF87]'}`}>
                      {formatCurrency(item.charge)}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="flex flex-col items-center justify-center py-16">
                <div className="w-12 h-12 rounded-2xl bg-slate-800/30 flex items-center justify-center mb-3">
                  <Clock size={22} className="text-faint" />
                </div>
                <p className="text-sm text-secondary font-medium">
                  No usage records yet
                </p>
                <p className="text-xs text-faint mt-1">
                  Launch a workspace to see your usage here
                </p>
              </div>
            )}
            
            {/* Table footer — total */}
            {usage.length > 0 && (
              <div className="grid grid-cols-[1fr_1.5fr_0.8fr_0.8fr_0.8fr] gap-4 px-5 py-3 bg-canvas/30 border-t border-border-subtle">
                <span />
                <span className="text-[10px] uppercase tracking-widest text-muted font-semibold flex items-center">
                  Total
                </span>
                <span className="text-sm text-primary font-semibold tabular-nums flex items-center">
                  {formatDuration(usage.reduce((sum, u) => sum + (u.duration_hours || 0), 0))}
                </span>
                <span />
                <span className="text-sm text-primary font-bold tabular-nums flex items-center">
                  {formatCurrency(usage.reduce((sum, u) => sum + (u.charge || 0), 0))}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Payment History Tab */}
      {activeTab === 'payments' && (
        <div className="bg-card/70 backdrop-blur-sm border border-border rounded-2xl overflow-hidden overflow-x-auto">
          <div className="min-w-[800px]">
            {/* Table header */}
            <div className="grid grid-cols-[0.8fr_1fr_1fr_1fr_0.8fr_0.5fr] gap-4 px-5 py-3 border-b border-border-subtle">
              {['Date', 'Description', 'Amount', 'Method', 'Status', ''].map(h => (
                <span key={h} className="text-[9px] uppercase tracking-widest text-muted font-semibold">
                  {h}
                </span>
              ))}
            </div>
            
            {/* Payment rows */}
            {payments.length > 0 ? (
              payments.map((p, i) => (
                <div key={i} className={`grid grid-cols-[0.8fr_1fr_1fr_1fr_0.8fr_0.5fr] gap-4 px-5 py-4 border-b border-slate-800/20 billing-row transition-colors`}>
                  
                  {/* Date */}
                  <div>
                    <p className="text-sm text-primary font-medium">
                      {new Date(p.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                    </p>
                    <p className="text-[10px] text-faint">
                      {p.time}
                    </p>
                  </div>
                  
                  {/* Description */}
                  <div className="flex items-center">
                    <div>
                      <p className="text-xs text-primary font-medium">
                        {p.description}
                      </p>
                      <p className="text-[10px] text-faint mt-0.5 font-mono">
                        {p.reference}
                      </p>
                    </div>
                  </div>
                  
                  {/* Amount */}
                  <div className="flex items-center">
                    <span className="text-sm font-bold text-primary tabular-nums">
                      {formatCurrency(p.amount)}
                    </span>
                  </div>
                  
                  {/* Method */}
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-md bg-[#00FF87]/10 flex items-center justify-center">
                      <CreditCard size={12} className="text-[#00FF87]" />
                    </div>
                    <span className="text-xs text-secondary">
                      {p.method}
                    </span>
                  </div>
                  
                  {/* Status */}
                  <div className="flex items-center">
                    {p.status === 'completed' ? (
                      <span className="flex items-center gap-1.5 text-[10px] font-semibold text-[#00FF87] uppercase tracking-wider bg-[#00FF87]/10 px-2.5 py-1 rounded-full">
                        <CheckCircle size={10} />
                        Paid
                      </span>
                    ) : p.status === 'pending' ? (
                      <span className="flex items-center gap-1.5 text-[10px] font-semibold text-[#FF6B00] uppercase tracking-wider bg-[#FF6B00]/10 px-2.5 py-1 rounded-full">
                        <AlertCircle size={10} />
                        Pending
                      </span>
                    ) : (
                      <span className="flex items-center gap-1.5 text-[10px] font-semibold text-[#FF3366] uppercase tracking-wider bg-[#FF3366]/10 px-2.5 py-1 rounded-full">
                        <XCircle size={10} />
                        Failed
                      </span>
                    )}
                  </div>
                  
                  {/* Download receipt */}
                  <div className="flex items-center justify-end">
                    {p.status === 'completed' && (
                      <button
                        onClick={() => handleViewReceipt(p.id)}
                        disabled={downloading === p.id}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800/30 border border-slate-700/30 text-secondary hover:text-primary hover:border-slate-500 active:scale-95 transition-all text-[11px] font-medium disabled:opacity-30">
                        {downloading === p.id ? (
                          <div className="w-3.5 h-3.5 border border-slate-400/30 border-t-slate-400 rounded-full animate-spin mx-1" />
                        ) : (
                          <>
                            <FileText size={12} />
                            Receipt
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="flex flex-col items-center justify-center py-16">
                <div className="w-12 h-12 rounded-2xl bg-slate-800/30 flex items-center justify-center mb-3">
                  <FileText size={22} className="text-faint" />
                </div>
                <p className="text-sm text-secondary font-medium">
                  No payments yet
                </p>
                <p className="text-xs text-faint mt-1">
                  Payments will appear here when you use paid features
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Receipt Modal */}
      {receiptData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) setReceiptData(null);
          }}>
          <div className="w-[600px] max-h-[90vh] overflow-auto rounded-2xl shadow-2xl shadow-black/50" id="receipt-container">
            
            {/* Receipt card */}
            <div className="bg-card border border-border rounded-2xl overflow-hidden">
              
              {/* Header */}
              <div className="relative overflow-hidden px-10 py-8"
                style={{
                  background: 'linear-gradient(135deg, #6C63FF 0%, #4F46E5 50%, #0066FF 100%)',
                }}>
                <div className="absolute top-[-50%] right-[-20%] w-[200px] h-[200px] bg-white/5 rounded-full" />
                <div className="relative flex justify-between items-start">
                  <div>
                    <h1 className="text-[22px] font-extrabold text-primary tracking-tight">
                      CloudDesk
                    </h1>
                    <p className="text-[10px] text-primary/60 uppercase tracking-[3px] mt-1 font-medium">
                      Cloud Virtual Desktops
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[11px] text-primary/70 uppercase tracking-[2px] font-semibold">
                      Payment Receipt
                    </p>
                    <p className="text-lg font-bold text-primary font-mono mt-1">
                      {receiptData.receipt_number}
                    </p>
                  </div>
                </div>
              </div>
              
              {/* Body */}
              <div className="px-10 py-8">
                
                {/* Date + Customer */}
                <div className="grid grid-cols-2 gap-6 mb-7">
                  <div>
                    <p className="text-[9px] uppercase tracking-[2px] text-muted font-semibold mb-1.5">Date</p>
                    <p className="text-[14px] text-primary font-medium">{receiptData.date}</p>
                  </div>
                  <div>
                    <p className="text-[9px] uppercase tracking-[2px] text-muted font-semibold mb-1.5">Time</p>
                    <p className="text-[14px] text-primary font-medium">{receiptData.time}</p>
                  </div>
                  <div>
                    <p className="text-[9px] uppercase tracking-[2px] text-muted font-semibold mb-1.5">Customer</p>
                    <p className="text-[14px] text-primary font-medium">{receiptData.customer_name}</p>
                  </div>
                  <div>
                    <p className="text-[9px] uppercase tracking-[2px] text-muted font-semibold mb-1.5">Email</p>
                    <p className="text-[14px] text-primary font-medium">{receiptData.customer_email}</p>
                  </div>
                </div>
                
                {/* Divider */}
                <div className="border-t border-border mb-7" />
                
                {/* Description */}
                <div className="mb-7">
                  <p className="text-[9px] uppercase tracking-[2px] text-muted font-semibold mb-1.5">Description</p>
                  <p className="text-[14px] text-primary font-medium">{receiptData.description}</p>
                </div>
                
                {/* Amount box */}
                <div className="bg-sidebar border border-border rounded-2xl p-6 flex justify-between items-center mb-7">
                  <div>
                    <p className="text-[9px] uppercase tracking-[2px] text-muted font-semibold mb-2">Amount Paid</p>
                    <p className="text-[32px] font-extrabold text-primary tracking-tight">
                      <span className="text-[16px] font-semibold opacity-50 mr-1">TZS</span>
                      {Number(receiptData.amount).toLocaleString()}
                    </p>
                  </div>
                  <span className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-wider border ${
                    receiptData.status === 'completed' 
                      ? 'bg-[#00FF87]/10 text-[#00FF87] border-[#00FF87]/20'
                      : 'bg-[#FF6B00]/10 text-[#FF6B00] border-[#FF6B00]/20'
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${
                      receiptData.status === 'completed' ? 'bg-[#00FF87]' : 'bg-[#FF6B00]'
                    }`} />
                    {receiptData.status}
                  </span>
                </div>
                
                {/* Method + Reference */}
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <p className="text-[9px] uppercase tracking-[2px] text-muted font-semibold mb-1.5">Payment Method</p>
                    <p className="text-[14px] text-primary font-medium">{receiptData.method}</p>
                  </div>
                  <div>
                    <p className="text-[9px] uppercase tracking-[2px] text-muted font-semibold mb-1.5">Reference Number</p>
                    <p className="text-[13px] text-primary font-mono">{receiptData.reference}</p>
                  </div>
                </div>
              </div>
              
              {/* Footer */}
              <div className="text-center px-10 py-6 border-t border-border bg-sidebar">
                <p className="text-[11px] text-muted font-semibold">
                  CloudDesk — Cloud Virtual Desktop Infrastructure
                </p>
                <p className="text-[11px] text-faint mt-1">Dar es Salaam, Tanzania</p>
                <p className="text-[11px] text-faint">support@clouddesk.io</p>
                <p className="text-[10px] text-[#6C63FF] mt-3 font-medium">
                  Please keep this receipt for your records
                </p>
                <p className="text-[9px] text-faint mt-1">
                  Computer-generated receipt. No signature required.
                </p>
              </div>
            </div>
            
            {/* Action buttons outside card */}
            <div className="flex gap-3 mt-4 justify-center">
              <button
                onClick={() => {
                  const printWindow = window.open(
                    '', '_blank', 'width=700,height=900');
                  
                  const r = receiptData;
                  const statusColor = r.status === 'completed' 
                    ? '#059669' : '#D97706';
                  
                  printWindow.document.write(`
                    <!DOCTYPE html>
                    <html>
                    <head>
                    <title>CloudDesk Receipt ${r.receipt_number}</title>
                    <style>
                      * { margin: 0; padding: 0; 
                        box-sizing: border-box; }
                      body {
                        font-family: -apple-system, 
                          BlinkMacSystemFont, 'Segoe UI', 
                          sans-serif;
                        background: #fff;
                        color: #1a1a1a;
                        padding: 40px;
                        max-width: 650px;
                        margin: 0 auto;
                      }
                      .header {
                        background: #6C63FF;
                        color: white;
                        padding: 28px 32px;
                        border-radius: 12px 12px 0 0;
                        display: flex;
                        justify-content: space-between;
                        align-items: flex-start;
                      }
                      .logo { font-size: 22px; 
                        font-weight: 800; }
                      .logo span { display: block; 
                        font-size: 9px; font-weight: 400; 
                        letter-spacing: 2px; opacity: 0.7; 
                        text-transform: uppercase; 
                        margin-top: 3px; }
                      .receipt-id { text-align: right; }
                      .receipt-id h2 { font-size: 10px; 
                        letter-spacing: 2px; opacity: 0.8; 
                        text-transform: uppercase; }
                      .receipt-id p { font-size: 16px; 
                        font-weight: 700; 
                        font-family: monospace; 
                        margin-top: 4px; }
                      .body { padding: 32px; 
                        border: 1px solid #e5e7eb; 
                        border-top: none; }
                      .row { display: flex; 
                        margin-bottom: 20px; }
                      .col { flex: 1; }
                      .label { font-size: 9px; 
                        text-transform: uppercase; 
                        letter-spacing: 2px; 
                        color: #888; font-weight: 600; 
                        margin-bottom: 4px; }
                      .value { font-size: 14px; 
                        color: #1a1a1a; font-weight: 500; }
                      .divider { border-top: 1px solid #eee; 
                        margin: 20px 0; }
                      .amount-box { background: #f9fafb; 
                        border: 1px solid #e5e7eb; 
                        border-radius: 10px; padding: 20px; 
                        display: flex; 
                        justify-content: space-between; 
                        align-items: center; 
                        margin: 20px 0; }
                      .amount { font-size: 28px; 
                        font-weight: 800; color: #111; }
                      .amount small { font-size: 14px; 
                        font-weight: 600; color: #888; 
                        margin-right: 4px; }
                      .status { display: inline-flex; 
                        align-items: center; gap: 5px; 
                        padding: 5px 12px; 
                        border-radius: 20px; 
                        font-size: 10px; font-weight: 700; 
                        text-transform: uppercase; 
                        letter-spacing: 1px; 
                        background: ${statusColor}15; 
                        color: ${statusColor}; }
                      .dot { width: 6px; height: 6px; 
                        border-radius: 50%; 
                        background: ${statusColor}; }
                      .footer { text-align: center; 
                        padding: 20px 32px; 
                        border: 1px solid #e5e7eb; 
                        border-top: none; 
                        border-radius: 0 0 12px 12px; 
                        background: #f9fafb; }
                      .footer p { font-size: 11px; 
                        color: #888; margin: 2px 0; }
                      .footer .keep { color: #6C63FF; 
                        font-weight: 500; margin-top: 10px; }
                      .footer .disclaimer { font-size: 9px; 
                        color: #aaa; margin-top: 6px; }
                      .no-print { margin-top: 24px; 
                        text-align: center; }
                      .btn { padding: 12px 28px; 
                        border: none; border-radius: 8px; 
                        font-size: 14px; font-weight: 600; 
                        cursor: pointer; margin: 0 6px; }
                      .btn-primary { background: #6C63FF; 
                        color: white; }
                      .btn-secondary { background: #f3f4f6; 
                        color: #666; border: 1px solid #ddd; }
                      @media print {
                        .no-print { display: none; }
                        body { padding: 20px; }
                        .header { -webkit-print-color-adjust: 
                          exact; print-color-adjust: exact; }
                        .status { -webkit-print-color-adjust: 
                          exact; print-color-adjust: exact; }
                      }
                    </style>
                    </head>
                    <body>
                    
                    <div class="header">
                      <div class="logo">
                        CloudDesk
                        <span>Cloud Virtual Desktops</span>
                      </div>
                      <div class="receipt-id">
                        <h2>Payment Receipt</h2>
                        <p>${r.receipt_number}</p>
                      </div>
                    </div>
                    
                    <div class="body">
                      <div class="row">
                        <div class="col">
                          <div class="label">Date</div>
                          <div class="value">${r.date}</div>
                        </div>
                        <div class="col">
                          <div class="label">Time</div>
                          <div class="value">${r.time}</div>
                        </div>
                      </div>
                      
                      <div class="row">
                        <div class="col">
                          <div class="label">Customer</div>
                          <div class="value">
                            ${r.customer_name}
                          </div>
                        </div>
                        <div class="col">
                          <div class="label">Email</div>
                          <div class="value">
                            ${r.customer_email}
                          </div>
                        </div>
                      </div>
                      
                      <div class="divider"></div>
                      
                      <div class="row">
                        <div class="col">
                          <div class="label">Description</div>
                          <div class="value">
                            ${r.description}
                          </div>
                        </div>
                      </div>
                      
                      <div class="amount-box">
                        <div>
                          <div class="label">Amount Paid</div>
                          <div class="amount">
                            <small>TZS</small>
                            ${Number(r.amount).toLocaleString()}
                          </div>
                        </div>
                        <span class="status">
                          <span class="dot"></span>
                          ${r.status.toUpperCase()}
                        </span>
                      </div>
                      
                      <div class="row">
                        <div class="col">
                          <div class="label">
                            Payment Method
                          </div>
                          <div class="value">${r.method}</div>
                        </div>
                        <div class="col">
                          <div class="label">
                            Reference Number
                          </div>
                          <div class="value" 
                            style="font-family: monospace;">
                            ${r.reference}
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div class="footer">
                      <p><strong>CloudDesk</strong> — 
                        Cloud Virtual Desktop 
                        Infrastructure</p>
                      <p>Dar es Salaam, Tanzania · 
                        support@clouddesk.io</p>
                      <p class="keep">Please keep this 
                        receipt for your records</p>
                      <p class="disclaimer">
                        Computer-generated receipt. 
                        No signature required.</p>
                    </div>
                    
                    <div class="no-print">
                      <button class="btn btn-primary" 
                        onclick="window.print()">
                        Save as PDF
                      </button>
                      <button class="btn btn-secondary" 
                        onclick="window.close()">
                        Close
                      </button>
                    </div>
                    
                    </body>
                    </html>
                  `);
                  
                  printWindow.document.close();
                }}
                className="flex items-center gap-2 px-6 py-3 rounded-xl bg-[#6C63FF] text-white text-sm font-semibold hover:bg-[#5B54E6] active:scale-95 transition-all shadow-lg shadow-purple-500/20">
                <Download size={16} />
                Print / Save PDF
              </button>
              <button
                onClick={() => setReceiptData(null)}
                className="flex items-center gap-2 px-6 py-3 rounded-xl bg-[#1E293B] text-secondary text-sm font-semibold border border-border-strong hover:bg-slate-800 active:scale-95 transition-all">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

          </div>
        </div>
      </div>
      <style>{`
        @keyframes scaleIn {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </>
  );
}
