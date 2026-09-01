import React from 'react';
import {
  KeyRound,
  ShieldCheck,
  Database,
  Sparkles,
  Mail,
  Save,
  CheckCircle2,
  RefreshCw,
  Activity,
  AlertCircle,
  FileKey,
} from 'lucide-react';
import { useCredStore } from '../store/useCredStore';
import { useLogStore } from '../store/useLogStore';
import { MaskedEnvInput } from '../components/credentials/MaskedEnvInput';
import { EnvLoadedBadge } from '../components/credentials/EnvLoadedBadge';

export const CredentialsPage: React.FC = () => {
  const {
    credentials,
    isSaving,
    isTesting,
    saveSuccessMessage,
    envLoadedSections,
    testResults,
    vendorLoginProgress,
    updateVendor,
    updateAmazon,
    updateClaude,
    updateEmail,
    saveToEnv,
    saveVendorToEnv,
    testConnection,
  } = useCredStore();

  const addLog = useLogStore((state) => state.addLog);

  const inputRing = 'focus:ring-blue-500/20';
  const inputRingIndigo = 'focus:ring-indigo-500/20';
  const inputRingEmerald = 'focus:ring-emerald-500/20';

  const handleSaveAll = async (e?: React.MouseEvent) => {
    e?.preventDefault();
    addLog('INFO', 'SYSTEM', 'Writing all credentials to root .env file & clearing visible keys...');
    await saveToEnv('ALL');
    addLog('SUCCESS', 'SYSTEM', 'Credentials permanently stored in .env & secret textboxes cleared.');
  };

  const handleSaveVendor = async (e?: React.MouseEvent) => {
    e?.preventDefault();
    addLog('INFO', 'LOGIN', 'Saving Seawide username & password to .env...');
    const ok = await saveVendorToEnv();
    if (ok) {
      addLog('SUCCESS', 'LOGIN', 'Seawide vendor login saved to .env.');
    } else {
      addLog('ERROR', 'LOGIN', 'Could not save vendor login — enter username and password first.');
    }
  };

  const handleTest = async (section: 'VENDOR' | 'AMAZON' | 'CLAUDE' | 'EMAIL') => {
    addLog('INFO', 'LOGIN', `Initiating live test handshake for ${section}...`);
    const ok = await testConnection(section);
    if (section === 'VENDOR') {
      if (ok) {
        addLog('SUCCESS', 'LOGIN', 'Seawide B2B vendor login verified — home page confirmed.');
      } else {
        addLog('ERROR', 'LOGIN', 'Seawide B2B vendor login test failed. Check credentials and try again.');
      }
    } else if (ok) {
      addLog('SUCCESS', 'LOGIN', `Handshake verified for ${section}!`);
    }
  };

  return (
    <div className="h-full flex flex-col p-6 overflow-hidden">
      {/* Top Banner */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-200 shrink-0">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center space-x-2">
            <KeyRound className="w-5 h-5 text-blue-600" />
            <span>API Credentials & Access Control</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Section A: apna Seawide username aur password type karein → <strong>Save Vendor Login</strong> → <strong>Test Vendor Login</strong>.
            Ye values root <code className="font-mono text-blue-600 bg-blue-50 px-1 py-0.5 rounded">.env</code> mein save hoti hain.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          {saveSuccessMessage && (
            <span className="text-xs font-bold text-emerald-800 bg-emerald-100 border border-emerald-300 px-3 py-1.5 rounded-lg animate-in fade-in">
              {saveSuccessMessage}
            </span>
          )}

          <button
            type="button"
            onClick={handleSaveAll}
            disabled={isSaving}
            className={`flex items-center space-x-1.5 px-5 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all shadow-md cursor-pointer ${
              isSaving
                ? 'bg-blue-300 text-white cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-600/30 active:scale-95'
            }`}
          >
            <Save className="w-4 h-4" />
            <span>{isSaving ? 'Writing to .env...' : 'Save to .env & Mask Keys'}</span>
          </button>
        </div>
      </div>

      {/* Main Grid: 4 Distinct Sections */}
      <div className="flex-1 min-h-0 grid grid-cols-2 gap-6 pt-4 overflow-y-auto">
        {/* Section A: Vendor Credentials */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 space-y-4 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center space-x-2">
                <ShieldCheck className="w-4 h-4 text-blue-600" />
                <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                  Section A: Seawide Vendor Portal Auth
                </h3>
              </div>
              <div className="flex items-center space-x-1.5">
                <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 flex items-center space-x-1">
                  <FileKey className="w-3 h-3 text-slate-400" />
                  <span>.env Linked</span>
                </span>
                {envLoadedSections.VENDOR && <EnvLoadedBadge />}
                {credentials.vendor.isConnected && (
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 flex items-center space-x-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    <span>Live 200 OK</span>
                  </span>
                )}
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Vendor Portal URL</label>
                <input
                  type="text"
                  value={credentials.vendor.portalUrl}
                  onChange={(e) => updateVendor({ portalUrl: e.target.value })}
                  placeholder="https://www.seawideb2b.com/Login?returnUrl=%2f"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Seawide Username / Dealer ID</label>
                <MaskedEnvInput
                  value={credentials.vendor.email}
                  maskedFromEnv={envLoadedSections.VENDOR}
                  onChange={(email) => updateVendor({ email })}
                  placeholder="Apna Seawide username / Dealer ID"
                  className={inputRing}
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Portal Password</label>
                <MaskedEnvInput
                  value={credentials.vendor.password}
                  maskedFromEnv={envLoadedSections.VENDOR}
                  onChange={(password) => updateVendor({ password })}
                  placeholder="Apna Seawide portal password"
                  showToggle
                  mono
                  className={inputRing}
                />
              </div>

              {/* Live login progress */}
              {isTesting['VENDOR'] && vendorLoginProgress && (
                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-[11px]">
                  <div className="flex items-center space-x-2 font-semibold text-slate-700">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-600 shrink-0" />
                    <span>{vendorLoginProgress}</span>
                  </div>
                  <p className="text-slate-500 mt-1 pl-5">
                    Uses a real browser session to pass portal security checks. This may take 30–60 seconds.
                  </p>
                </div>
              )}

              {/* Live Test Diagnostic Card */}
              {testResults.VENDOR && !isTesting['VENDOR'] && (
                <div
                  className={`p-3 rounded-lg border text-[11px] space-y-1.5 ${
                    testResults.VENDOR.status === 'SUCCESS'
                      ? 'bg-emerald-50/70 border-emerald-200'
                      : 'bg-red-50/70 border-red-200'
                  }`}
                >
                  <div
                    className={`flex items-center justify-between font-bold ${
                      testResults.VENDOR.status === 'SUCCESS' ? 'text-emerald-900' : 'text-red-900'
                    }`}
                  >
                    <span className="flex items-center space-x-1">
                      {testResults.VENDOR.status === 'SUCCESS' ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      ) : (
                        <AlertCircle className="w-3.5 h-3.5 text-red-600 shrink-0" />
                      )}
                      <span>{testResults.VENDOR.message}</span>
                    </span>
                    {testResults.VENDOR.details.responseTimeMs != null && (
                      <span className="font-mono text-slate-600 shrink-0 ml-2">
                        {(testResults.VENDOR.details.responseTimeMs / 1000).toFixed(1)}s
                      </span>
                    )}
                  </div>
                  {testResults.VENDOR.details.welcomeText && (
                    <div className="text-emerald-800 font-medium">
                      {testResults.VENDOR.details.welcomeText}
                    </div>
                  )}
                  <div className="text-slate-600 flex flex-col gap-0.5 pt-0.5">
                    {testResults.VENDOR.details.finalUrl && (
                      <span className="truncate" title={testResults.VENDOR.details.finalUrl}>
                        Landed: {testResults.VENDOR.details.finalUrl}
                      </span>
                    )}
                    {testResults.VENDOR.details.pageTitle && (
                      <span>Page: {testResults.VENDOR.details.pageTitle}</span>
                    )}
                    <span className="font-medium">
                      {testResults.VENDOR.details.accountStatus}
                    </span>
                  </div>
                  {testResults.VENDOR.details.steps && testResults.VENDOR.details.steps.length > 0 && (
                    <details className="pt-1">
                      <summary className="cursor-pointer text-slate-500 hover:text-slate-700">
                        View login steps ({testResults.VENDOR.details.steps.length})
                      </summary>
                      <ol className="mt-1 pl-4 list-decimal text-slate-500 space-y-0.5 max-h-24 overflow-y-auto">
                        {testResults.VENDOR.details.steps.map((step, i) => (
                          <li key={i}>{step}</li>
                        ))}
                      </ol>
                    </details>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
            <span className="text-[11px] text-slate-400">
              Last tested: {credentials.vendor.lastTestedAt || 'Never'}
            </span>
            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={handleSaveVendor}
                disabled={isSaving}
                className="flex items-center space-x-1 px-3 py-1.5 rounded-lg border border-blue-300 bg-blue-50 hover:bg-blue-100 text-blue-800 text-xs font-semibold cursor-pointer shadow-xs transition-all disabled:opacity-50"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{isSaving ? 'Saving...' : 'Save Vendor Login'}</span>
              </button>
              <button
                type="button"
                onClick={() => handleTest('VENDOR')}
                disabled={isTesting['VENDOR']}
                title="Username + password type karein. Test pehle .env mein save karta hai."
                className="flex items-center space-x-1 px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold cursor-pointer shadow-xs transition-all"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isTesting['VENDOR'] ? 'animate-spin text-blue-600' : ''}`} />
                <span>{isTesting['VENDOR'] ? 'Testing Seawide Login...' : 'Test Vendor Login'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Section B: Amazon SP-API */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 space-y-4 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center space-x-2">
                <Database className="w-4 h-4 text-amber-600" />
                <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                  Section B: Amazon SP-API (Selling Partner)
                </h3>
              </div>
              <div className="flex items-center space-x-1.5">
                <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 flex items-center space-x-1">
                  <FileKey className="w-3 h-3 text-slate-400" />
                  <span>.env Linked</span>
                </span>
                {envLoadedSections.AMAZON && <EnvLoadedBadge />}
                {credentials.amazon.isConnected && (
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 flex items-center space-x-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    <span>OAuth Valid</span>
                  </span>
                )}
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">LWA Client ID (App ID)</label>
                <MaskedEnvInput
                  value={credentials.amazon.clientId}
                  maskedFromEnv={envLoadedSections.AMAZON}
                  onChange={(clientId) => updateAmazon({ clientId })}
                  placeholder="amzn1.application-oa2-client.xxxx"
                  mono
                  className={inputRing}
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">LWA Client Secret</label>
                <MaskedEnvInput
                  value={credentials.amazon.clientSecret}
                  maskedFromEnv={envLoadedSections.AMAZON}
                  onChange={(clientSecret) => updateAmazon({ clientSecret })}
                  placeholder="amzn1.oa2-cs.v1.xxxx"
                  showToggle
                  mono
                  className={inputRing}
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">LWA Refresh Token</label>
                <MaskedEnvInput
                  value={credentials.amazon.refreshToken}
                  maskedFromEnv={envLoadedSections.AMAZON}
                  onChange={(refreshToken) => updateAmazon({ refreshToken })}
                  placeholder="Atzr|xxxx"
                  showToggle
                  mono
                  className={inputRing}
                />
              </div>

              {/* Live Test Diagnostic Card */}
              {testResults.AMAZON && (
                <div className="p-3 rounded-lg bg-amber-50/70 border border-amber-200 text-[11px] space-y-1">
                  <div className="flex items-center justify-between font-bold text-amber-900">
                    <span className="flex items-center space-x-1">
                      <Activity className="w-3.5 h-3.5 text-amber-600" />
                      <span>{testResults.AMAZON.message}</span>
                    </span>
                    <span className="font-mono text-amber-700">{testResults.AMAZON.details.responseTimeMs}ms</span>
                  </div>
                  <div className="text-slate-600 flex justify-between pt-0.5">
                    <span>Rate Bucket: {testResults.AMAZON.details.rateLimitRemaining}</span>
                    <span className="font-medium text-emerald-700">{testResults.AMAZON.details.accountStatus}</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
            <span className="text-[11px] text-slate-400">
              Region: <strong>North America (NA)</strong>
            </span>
            <button
              type="button"
              onClick={() => handleTest('AMAZON')}
              disabled={isTesting['AMAZON']}
              className="flex items-center space-x-1 px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold cursor-pointer shadow-xs transition-all"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isTesting['AMAZON'] ? 'animate-spin text-amber-600' : ''}`} />
              <span>{isTesting['AMAZON'] ? 'Pinging SP-API...' : 'Test SP-API Connection'}</span>
            </button>
          </div>
        </div>

        {/* Section C: Claude AI */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 space-y-4 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center space-x-2">
                <Sparkles className="w-4 h-4 text-indigo-600" />
                <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                  Section C: Anthropic Claude Haiku 4.5 AI Engine
                </h3>
              </div>
              <div className="flex items-center space-x-1.5">
                <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 flex items-center space-x-1">
                  <FileKey className="w-3 h-3 text-slate-400" />
                  <span>.env Linked</span>
                </span>
                {envLoadedSections.CLAUDE && <EnvLoadedBadge />}
                {credentials.claude.isConnected && (
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 flex items-center space-x-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    <span>API Ready</span>
                  </span>
                )}
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Anthropic API Key</label>
                <MaskedEnvInput
                  value={credentials.claude.apiKey}
                  maskedFromEnv={envLoadedSections.CLAUDE}
                  onChange={(apiKey) => updateClaude({ apiKey })}
                  placeholder="sk-ant-api03-xxxx"
                  showToggle
                  mono
                  className={inputRingIndigo}
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Fixed AI Model</label>
                <div className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-lg text-slate-800 font-mono text-xs flex items-center justify-between">
                  <span className="font-bold text-indigo-950">Claude Haiku 4.5</span>
                  <span className="text-[10px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded">
                    Fixed Engine
                  </span>
                </div>
              </div>

              {/* Live Test Diagnostic Card */}
              {testResults.CLAUDE && (
                <div className="p-3 rounded-lg bg-indigo-50/70 border border-indigo-200 text-[11px] space-y-1">
                  <div className="flex items-center justify-between font-bold text-indigo-900">
                    <span className="flex items-center space-x-1">
                      <Activity className="w-3.5 h-3.5 text-indigo-600" />
                      <span>{testResults.CLAUDE.message}</span>
                    </span>
                    <span className="font-mono text-indigo-700">{testResults.CLAUDE.details.responseTimeMs}ms</span>
                  </div>
                  <div className="text-slate-600 flex justify-between pt-0.5">
                    <span>Rate: {testResults.CLAUDE.details.rateLimitRemaining}</span>
                    <span className="font-medium text-emerald-700">{testResults.CLAUDE.details.accountStatus}</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
            <span className="text-[11px] text-slate-400">
              Endpoint: <strong>https://api.anthropic.com/v1</strong>
            </span>
            <button
              type="button"
              onClick={() => handleTest('CLAUDE')}
              disabled={isTesting['CLAUDE']}
              className="flex items-center space-x-1 px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold cursor-pointer shadow-xs transition-all"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isTesting['CLAUDE'] ? 'animate-spin text-indigo-600' : ''}`} />
              <span>{isTesting['CLAUDE'] ? 'Testing API...' : 'Test Claude Endpoint'}</span>
            </button>
          </div>
        </div>

        {/* Section D: Email Settings (Gmail App Password) */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 space-y-4 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center space-x-2">
                <Mail className="w-4 h-4 text-emerald-600" />
                <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                  Section D: Email & Discrepancy Alerts
                </h3>
              </div>
              <div className="flex items-center space-x-1.5">
                <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 flex items-center space-x-1">
                  <FileKey className="w-3 h-3 text-slate-400" />
                  <span>.env Linked</span>
                </span>
                {envLoadedSections.EMAIL && <EnvLoadedBadge />}
                {credentials.email.isConnected && (
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 flex items-center space-x-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    <span>TLS 465 Ready</span>
                  </span>
                )}
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Sender Email Address</label>
                <MaskedEnvInput
                  value={credentials.email.senderEmail}
                  maskedFromEnv={envLoadedSections.EMAIL}
                  onChange={(senderEmail) => updateEmail({ senderEmail })}
                  placeholder="qc-alerts@seawide-ops.com"
                  type="text"
                  className={inputRingEmerald}
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Gmail App Password (16-char)</label>
                <MaskedEnvInput
                  value={credentials.email.gmailAppPassword}
                  maskedFromEnv={envLoadedSections.EMAIL}
                  onChange={(gmailAppPassword) => updateEmail({ gmailAppPassword })}
                  placeholder="abcd efgh ijkl mnop"
                  showToggle
                  mono
                  className={inputRingEmerald}
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">QC Manager Alert Recipient</label>
                <MaskedEnvInput
                  value={credentials.email.recipientAlertEmail}
                  maskedFromEnv={envLoadedSections.EMAIL}
                  onChange={(recipientAlertEmail) => updateEmail({ recipientAlertEmail })}
                  placeholder="qc-manager@seawidedist.com"
                  type="text"
                  className={inputRingEmerald}
                />
              </div>

              {/* Live Test Diagnostic Card */}
              {testResults.EMAIL && (
                <div className="p-3 rounded-lg bg-emerald-50/70 border border-emerald-200 text-[11px] space-y-1">
                  <div className="flex items-center justify-between font-bold text-emerald-900">
                    <span className="flex items-center space-x-1">
                      <Activity className="w-3.5 h-3.5 text-emerald-600" />
                      <span>{testResults.EMAIL.message}</span>
                    </span>
                    <span className="font-mono text-emerald-700">{testResults.EMAIL.details.responseTimeMs}ms</span>
                  </div>
                  <div className="text-slate-600 flex justify-between pt-0.5">
                    <span>Relay: {testResults.EMAIL.details.endpoint}</span>
                    <span className="font-medium text-emerald-700">{testResults.EMAIL.details.accountStatus}</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
            <span className="text-[11px] text-slate-400">
              Host: <strong>smtp.gmail.com:465</strong>
            </span>
            <button
              type="button"
              onClick={() => handleTest('EMAIL')}
              disabled={isTesting['EMAIL']}
              className="flex items-center space-x-1 px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold cursor-pointer shadow-xs transition-all"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isTesting['EMAIL'] ? 'animate-spin text-emerald-600' : ''}`} />
              <span>{isTesting['EMAIL'] ? 'Relaying TLS...' : 'Send Test Notification'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
