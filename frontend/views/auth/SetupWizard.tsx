import React, { useMemo, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Building2, CheckCircle2, ShieldCheck, UserPlus, Loader2, Sparkles, Receipt, CalendarDays, Mail, Phone, MapPin, Globe, User, Key, Lock, Plus, Upload, AlertCircle, CheckCircle } from 'lucide-react';
import { Input } from '../../components/Input';
import { useAuth } from '../../context/AuthContext';
import { dbService } from '../../services/db';
import { isPasswordComplexityEnabled, isPasswordProtectionEnabled, withNormalizedSecurityConfig } from '../../utils/securitySettings';

const SetupWizard: React.FC = () => {
  const navigate = useNavigate();
  const { companyConfig, completeSetup, validatePasswordStrength } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [setupMode, setSetupMode] = useState<'create' | 'restore' | null>(null);
  const [isRestoringBackup, setIsRestoringBackup] = useState(false);
  const [restoredCompanyData, setRestoredCompanyData] = useState<any>(null);

  const [company, setCompany] = useState({
    companyName: companyConfig?.companyName || '',
    email: companyConfig?.email || '',
    phone: companyConfig?.phone || '',
    addressLine1: companyConfig?.addressLine1 || '',
    city: companyConfig?.city || '',
    country: companyConfig?.country || '',
    currencySymbol: companyConfig?.currencySymbol || 'K',
    dateFormat: companyConfig?.dateFormat || 'DD/MM/YYYY',
    financialYearStart: (companyConfig as any)?.financialYearStart || 'January',
    fiscalYearEndMonth: (companyConfig as any)?.fiscalYearEndMonth || 'December',
    vatPricingMode: (companyConfig as any)?.vat?.pricingMode || 'VAT',
    passwordRequired: isPasswordProtectionEnabled(companyConfig),
    enforceComplexity: isPasswordComplexityEnabled(companyConfig),
  });

  const [admin, setAdmin] = useState({
    fullName: '',
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
  });

  const passwordValidation = useMemo(
    () => validatePasswordStrength(admin.password),
    [admin.password, validatePasswordStrength]
  );

  const canContinueCompany = [
    company.companyName,
    company.phone,
    company.addressLine1,
  ].every(value => value.trim().length > 0);

  const canContinueUser = [
    admin.fullName,
    admin.username,
  ].every(value => value.trim().length > 0);

  const canSubmitAdmin = [
    admin.fullName,
    admin.username,
  ].every(value => value.trim().length > 0)
    && (
      !(company as any).passwordRequired
      || (
        admin.password.length > 0
        && admin.password === admin.confirmPassword
        && (
          !(company as any).enforceComplexity
          || passwordValidation.valid
        )
      )
    );

  const handleRestoreBackupFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsRestoringBackup(true);
    setError(null);

    try {
      const fileContent = await file.text();
      const backupData = JSON.parse(fileContent);

      // Validate backup structure
      if (!backupData || typeof backupData !== 'object' || !backupData.data) {
        throw new Error('Invalid backup file format. Expected backup to contain meta and data sections.');
      }

      let companyConfigJson = backupData.settings?.['nexus_company_config'];
      if (!companyConfigJson && Array.isArray(backupData.data?.settings)) {
        const settingsEntry = backupData.data.settings.find((entry: any) =>
          entry?.id === 'nexus_company_config' || entry?.key === 'nexus_company_config'
        );
        if (settingsEntry?.value) {
          companyConfigJson = typeof settingsEntry.value === 'string'
            ? settingsEntry.value
            : JSON.stringify(settingsEntry.value);
        }
      }

      if (!companyConfigJson) {
        throw new Error('No company configuration found in backup file.');
      }

      const restoredConfig = JSON.parse(companyConfigJson);

      await dbService.importDatabase(fileContent);
      localStorage.setItem('nexus_company_config', companyConfigJson);
      localStorage.setItem('nexus_initialized', backupData.settings?.['nexus_initialized'] || 'true');
      localStorage.setItem('prime_erp_backup_restored', JSON.stringify({
        restoredAt: new Date().toISOString(),
        filename: file.name,
        snapshotDate: backupData.meta?.date
      }));

      setRestoredCompanyData(restoredConfig);
      
      // Update company form with restored data
      setCompany({
        companyName: restoredConfig.companyName || '',
        email: restoredConfig.email || '',
        phone: restoredConfig.phone || '',
        addressLine1: restoredConfig.addressLine1 || '',
        city: restoredConfig.city || '',
        country: restoredConfig.country || '',
        currencySymbol: restoredConfig.currencySymbol || 'K',
        dateFormat: restoredConfig.dateFormat || 'DD/MM/YYYY',
        financialYearStart: restoredConfig.financialYearStart || 'January',
        fiscalYearEndMonth: restoredConfig.fiscalYearEndMonth || 'December',
        vatPricingMode: restoredConfig.vat?.pricingMode || 'VAT',
        passwordRequired: isPasswordProtectionEnabled(restoredConfig),
        enforceComplexity: isPasswordComplexityEnabled(restoredConfig),
      });

      // Move to admin setup (skip company and financial setup)
      setStep(3);
      event.target.value = '';
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to restore backup file.');
      console.error('Restore error:', err);
      event.target.value = '';
    } finally {
      setIsRestoringBackup(false);
    }
  };

  const handleSetup = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSubmitAdmin) return;

    setSubmitting(true);
    setError(null);

    try {
      if ((company as any).passwordRequired && !admin.password) {
        throw new Error('Set an access password or turn off password protection.');
      }
      if (admin.password && admin.password !== admin.confirmPassword) {
        throw new Error("Passwords don't match.");
      }
      if ((company as any).passwordRequired && (company as any).enforceComplexity && admin.password && !passwordValidation.valid) {
        throw new Error(passwordValidation.errors[0] || 'Password does not meet the required complexity.');
      }

      const baseConfig = {
        ...companyConfig,
        ...company,
      } as any;

      const finalConfig = withNormalizedSecurityConfig({
        ...baseConfig,
        financialYearStart: company.financialYearStart,
        fiscalYearEndMonth: company.fiscalYearEndMonth,
        securitySettings: {
          ...(baseConfig.securitySettings || {}),
          passwordProtectionEnabled: (company as any).passwordRequired,
          enforcePasswordComplexity: (company as any).enforceComplexity,
        },
        vat: {
          ...(baseConfig.vat || {
            enabled: true,
            rate: 16.5,
            filingFrequency: 'Monthly',
            pricingMode: 'VAT',
          }),
          pricingMode: company.vatPricingMode,
        },
      });

      await completeSetup(
        finalConfig,
        {
          id: '',
          username: admin.username.trim(),
          fullName: admin.fullName.trim(),
          name: admin.fullName.trim(),
          email: admin.email.trim(),
          password: admin.password,
          role: 'Admin',
          status: 'Active',
          active: true,
          isSuperAdmin: true,
          mfaEnabled: false,
          groupIds: ['GRP-ADMIN'],
        } as any
      );

      navigate('/', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Setup failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const goToStep = (newStep: number) => {
    if (newStep === step || isTransitioning || newStep < 0 || newStep >= steps.length) return;
    setIsTransitioning(true);
    setTimeout(() => {
      setStep(newStep);
      setIsTransitioning(false);
    }, 150);
  };

  const steps = [
    { label: 'Setup Mode', icon: Building2 },
    { label: 'Company', icon: Building2 },
    { label: 'Financial', icon: CalendarDays },
    { label: 'User Account', icon: UserPlus },
    { label: 'Password Setup', icon: Key },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      {/* Subtle background accents */}
      <div className="fixed top-0 right-0 w-[500px] h-[500px] bg-blue-500/5 rounded-full blur-[120px]" />
      <div className="fixed bottom-0 left-0 w-[500px] h-[500px] bg-indigo-500/5 rounded-full blur-[120px]" />

      <div className="w-full max-w-xl relative z-10">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-blue-500/10 border border-blue-500/20 rounded-full mb-4">
            <ShieldCheck size={16} className="text-blue-400" />
            <span className="text-sm font-medium text-blue-300">Setup Wizard</span>
          </div>
          <h1 className="text-4xl font-bold text-white mb-2">
            Welcome to <span className="bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">Prime ERP</span>
          </h1>
          <p className="text-slate-400">Complete your setup in three simple steps</p>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {steps.map((s, i) => (
            <React.Fragment key={i}>
              <button
                type="button"
                onClick={() => i < step && goToStep(i)}
                disabled={i > step}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-300 ${
                  i === step
                    ? 'bg-gradient-to-r from-blue-500 to-indigo-500 text-white shadow-lg shadow-blue-500/30'
                    : i < step
                      ? 'bg-white/10 text-white hover:bg-white/20 cursor-pointer'
                      : 'bg-white/5 text-slate-500 cursor-not-allowed'
                }`}
              >
                {i < step ? (
                  <CheckCircle2 size={16} />
                ) : (
                  <s.icon size={16} />
                )}
                <span className="hidden sm:inline">{s.label}</span>
              </button>
              {i < steps.length - 1 && (
                <div className={`w-8 h-0.5 rounded-full transition-all duration-500 ${
                  i < step ? 'bg-gradient-to-r from-blue-500 to-indigo-500' : 'bg-white/10'
                }`} />
              )}
            </React.Fragment>
          ))}
        </div>

        {/* Main Card */}
        <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 shadow-2xl overflow-hidden">
          <form onSubmit={handleSetup}>
            {/* Scrollable Content */}
            <div className="p-6 max-h-[60vh] overflow-y-auto">
              <div className={`transition-all duration-150 ${isTransitioning ? 'opacity-0 translate-x-4' : 'opacity-100 translate-x-0'}`}>
                
                {/* Step 0: Setup Mode Selection */}
                {step === 0 && (
                  <div className="space-y-5">
                    <div className="mb-8">
                      <h2 className="text-2xl font-bold text-white mb-1">Get Started</h2>
                      <p className="text-slate-400 text-sm">How would you like to proceed?</p>
                    </div>

                    <div className="space-y-4">
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".db,.json,application/octet-stream,application/json"
                        onChange={handleRestoreBackupFile}
                        className="hidden"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setSetupMode('create');
                          setError(null);
                          goToStep(1);
                        }}
                        className="w-full p-6 rounded-xl border-2 border-white/10 hover:border-blue-500/50 hover:bg-blue-500/10 transition-all group text-left"
                      >
                        <div className="flex items-start gap-4">
                          <div className="w-12 h-12 rounded-lg bg-blue-500/20 flex items-center justify-center group-hover:bg-blue-500/30 transition-colors mt-1">
                            <Plus size={24} className="text-blue-400" />
                          </div>
                          <div>
                            <div className="text-white font-semibold mb-1">Create New Company</div>
                            <p className="text-slate-400 text-sm">Set up a fresh Prime ERP instance for your organization</p>
                          </div>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setSetupMode('restore');
                          setError(null);
                          fileInputRef.current?.click();
                        }}
                        className="w-full p-6 rounded-xl border-2 border-white/10 hover:border-purple-500/50 hover:bg-purple-500/10 transition-all group text-left disabled:opacity-50 disabled:cursor-not-allowed"
                        disabled={isRestoringBackup}
                      >
                        <div className="flex items-start gap-4">
                          <div className="w-12 h-12 rounded-lg bg-purple-500/20 flex items-center justify-center group-hover:bg-purple-500/30 transition-colors mt-1">
                            <Upload size={24} className="text-purple-400" />
                          </div>
                          <div>
                            <div className="text-white font-semibold mb-1">Restore Existing Company</div>
                            <p className="text-slate-400 text-sm">{isRestoringBackup ? 'Restoring backup file...' : 'Upload a backup file to restore your previous configuration'}</p>
                          </div>
                        </div>
                      </button>
                    </div>
                  </div>
                )}

                {/* Step 1: Company Profile */}
                {step === 1 && (
                  <div className="space-y-5">
                    <div className="mb-6">
                      <h2 className="text-2xl font-bold text-white mb-1">Company Profile</h2>
                      <p className="text-slate-400 text-sm">Tell us about your organization</p>
                    </div>

                    {error && (
                      <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-300 text-sm">
                        {error}
                      </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-slate-300 uppercase tracking-wide">Company Name *</label>
                        <Input
                          value={company.companyName}
                          onChange={e => setCompany(prev => ({ ...prev, companyName: e.target.value }))}
                          className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:bg-white/10 focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 text-white text-sm transition-all"
                          placeholder="Acme Corporation"
                          required
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-slate-300 uppercase tracking-wide">Business Email</label>
                        <Input
                          type="email"
                          value={company.email}
                          onChange={e => setCompany(prev => ({ ...prev, email: e.target.value }))}
                          className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:bg-white/10 focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 text-white text-sm transition-all"
                          placeholder="contact@company.com"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-slate-300 uppercase tracking-wide">Phone Number *</label>
                        <Input
                          value={company.phone}
                          onChange={e => setCompany(prev => ({ ...prev, phone: e.target.value }))}
                          className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:bg-white/10 focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 text-white text-sm transition-all"
                          placeholder="+1 (555) 000-0000"
                          required
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-slate-300 uppercase tracking-wide">City</label>
                        <Input
                          value={company.city}
                          onChange={e => setCompany(prev => ({ ...prev, city: e.target.value }))}
                          className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:bg-white/10 focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 text-white text-sm transition-all"
                          placeholder="New York"
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-300 uppercase tracking-wide">Physical Address *</label>
                      <Input
                        value={company.addressLine1}
                        onChange={e => setCompany(prev => ({ ...prev, addressLine1: e.target.value }))}
                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:bg-white/10 focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 text-white text-sm transition-all"
                        placeholder="123 Business Way, Suite 100"
                        required
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-slate-300 uppercase tracking-wide">Currency</label>
                        <select
                          value={company.currencySymbol}
                          onChange={e => setCompany(prev => ({ ...prev, currencySymbol: e.target.value }))}
                          className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:bg-white/10 focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 text-white text-sm transition-all outline-none"
                        >
                          <option value="K" className="bg-slate-900">K - Zambian Kwacha</option>
                          <option value="MWK" className="bg-slate-900">MWK - Malawi Kwacha</option>
                          <option value="$" className="bg-slate-900">$ - US Dollar</option>
                          <option value="£" className="bg-slate-900">£ - British Pound</option>
                          <option value="€" className="bg-slate-900">€ - Euro</option>
                        </select>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-slate-300 uppercase tracking-wide">Date Format</label>
                        <select
                          value={company.dateFormat}
                          onChange={e => setCompany(prev => ({ ...prev, dateFormat: e.target.value }))}
                          className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:bg-white/10 focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 text-white text-sm transition-all outline-none"
                        >
                          <option value="DD/MM/YYYY" className="bg-slate-900">DD/MM/YYYY</option>
                          <option value="MM/DD/YYYY" className="bg-slate-900">MM/DD/YYYY</option>
                          <option value="YYYY-MM-DD" className="bg-slate-900">YYYY-MM-DD</option>
                        </select>
                      </div>
                    </div>
                  </div>
                )}

                {/* Step 2: Financial Setup */}
                {step === 2 && (
                  <div className="space-y-5">
                    <div className="mb-6">
                      <h2 className="text-2xl font-bold text-white mb-1">Financial Setup</h2>
                      <p className="text-slate-400 text-sm">Configure financial year and pricing preferences</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-slate-300 uppercase tracking-wide">Financial Year Start</label>
                        <select
                          value={company.financialYearStart}
                          onChange={e => setCompany(prev => ({ ...prev, financialYearStart: e.target.value }))}
                          className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:bg-white/10 focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 text-white text-sm transition-all outline-none"
                        >
                          {['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'].map(month => (
                            <option key={month} value={month} className="bg-slate-900">{month}</option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-slate-300 uppercase tracking-wide">Financial Year End</label>
                        <select
                          value={company.fiscalYearEndMonth}
                          onChange={e => setCompany(prev => ({ ...prev, fiscalYearEndMonth: e.target.value }))}
                          className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:bg-white/10 focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 text-white text-sm transition-all outline-none"
                        >
                          {['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'].map(month => (
                            <option key={month} value={month} className="bg-slate-900">{month}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <label className="text-xs font-semibold text-slate-300 uppercase tracking-wide">Pricing Mode</label>
                      <p className="text-slate-400 text-sm">Select how your system handles pricing and tax</p>
                      
                      <div className="grid grid-cols-2 gap-3">
                        <button
                          type="button"
                          onClick={() => setCompany(prev => ({ ...prev, vatPricingMode: 'VAT' }))}
                          className={`p-4 rounded-xl border text-left transition-all duration-300 ${
                            company.vatPricingMode === 'VAT'
                              ? 'bg-purple-500/20 border-purple-500/50 text-white'
                              : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10 hover:border-white/20'
                          }`}
                        >
                          <Receipt size={20} className="mb-2" />
                          <div className="font-semibold">Tax (VAT)</div>
                          <div className="text-xs opacity-70">Standard tax pricing</div>
                        </button>

                        <button
                          type="button"
                          onClick={() => setCompany(prev => ({ ...prev, vatPricingMode: 'MarketAdjustment' }))}
                          className={`p-4 rounded-xl border text-left transition-all duration-300 ${
                            company.vatPricingMode === 'MarketAdjustment'
                              ? 'bg-purple-500/20 border-purple-500/50 text-white'
                              : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10 hover:border-white/20'
                          }`}
                        >
                          <Sparkles size={20} className="mb-2" />
                          <div className="font-semibold">Market Adj.</div>
                          <div className="text-xs opacity-70">Dynamic pricing</div>
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Step 3: User Account */}
                {step === 3 && (
                  <div className="space-y-5">
                    <div className="mb-6">
                      <h2 className="text-2xl font-bold text-white mb-1">User Account</h2>
                      <p className="text-slate-400 text-sm">Create your primary user account</p>
                    </div>

                    {error && (
                      <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-300 text-sm">
                        {error}
                      </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-slate-300 uppercase tracking-wide">Full Name *</label>
                        <Input
                          value={admin.fullName}
                          onChange={e => setAdmin(prev => ({ ...prev, fullName: e.target.value }))}
                          className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:bg-white/10 focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 text-white text-sm transition-all"
                          placeholder="John Doe"
                          required
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-slate-300 uppercase tracking-wide">Email Address</label>
                        <Input
                          type="email"
                          value={admin.email}
                          onChange={e => setAdmin(prev => ({ ...prev, email: e.target.value }))}
                          className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:bg-white/10 focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 text-white text-sm transition-all"
                          placeholder="admin@company.com"
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-300 uppercase tracking-wide">Username *</label>
                      <Input
                        value={admin.username}
                        onChange={e => setAdmin(prev => ({ ...prev, username: e.target.value }))}
                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:bg-white/10 focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 text-white text-sm transition-all"
                        placeholder="admin_prime"
                        required
                      />
                    </div>
                  </div>
                )}

                {/* Step 4: Password Setup & Security Settings */}
                {step === 4 && (
                  <div className="space-y-6">
                    <div className="mb-6">
                      <div className="flex items-center gap-2 mb-1">
                        <h2 className="text-2xl font-bold text-white">Security Configuration</h2>
                        <div className="px-2 py-0.5 bg-blue-500/20 border border-blue-500/30 rounded text-[10px] font-bold text-blue-300 uppercase tracking-wider">
                          Optional
                        </div>
                      </div>
                      <p className="text-slate-400 text-sm">Configure how you'll access your account</p>
                    </div>

                    <div className="p-4 bg-blue-500/5 border border-blue-500/20 rounded-xl flex gap-3 items-start">
                      <AlertCircle size={18} className="text-blue-400 shrink-0 mt-0.5" />
                      <div className="text-xs text-blue-200/70 leading-relaxed">
                        Setting a password now is optional. You can enable password protection later in settings if you choose to skip this step.
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-slate-300 uppercase tracking-wide">Password</label>
                        <Input
                          type="password"
                          value={admin.password}
                          onChange={e => setAdmin(prev => ({ ...prev, password: e.target.value }))}
                          className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:bg-white/10 focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 text-white text-sm transition-all"
                          placeholder="Leave blank to skip"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-slate-300 uppercase tracking-wide">Confirm Password</label>
                        <Input
                          type="password"
                          value={admin.confirmPassword}
                          onChange={e => setAdmin(prev => ({ ...prev, confirmPassword: e.target.value }))}
                          className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:bg-white/10 focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 text-white text-sm transition-all"
                          placeholder="Repeat password"
                        />
                      </div>
                    </div>

                    {/* Password Strength */}
                    {admin.password && (
                      <div className="p-4 bg-white/5 rounded-xl border border-white/10 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-slate-300 uppercase tracking-wide">Strength</span>
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                            passwordValidation.valid
                              ? 'bg-emerald-500/20 text-emerald-300'
                              : 'bg-slate-500/20 text-slate-300'
                          }`}>
                            {passwordValidation.valid ? 'Strong' : 'Basic'}
                          </span>
                        </div>
                        <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                          <div className={`h-full transition-all duration-500 rounded-full ${
                            passwordValidation.valid
                              ? 'w-full bg-gradient-to-r from-emerald-500 to-teal-500'
                              : 'w-1/3 bg-gradient-to-r from-slate-500 to-slate-600'
                          }`} />
                        </div>
                        {!passwordValidation.valid && (
                          <p className="text-xs text-slate-400">{passwordValidation.errors.length > 0 ? 'Tip: ' + passwordValidation.errors[0] : 'Basic password strength'}</p>
                        )}
                        {admin.confirmPassword && admin.password !== admin.confirmPassword && (
                          <p className="text-xs text-rose-300">Passwords don't match</p>
                        )}
                      </div>
                    )}

                    {/* Security Settings Section */}
                    <div className="pt-4 border-t border-white/10 space-y-4">
                      <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Global Security Settings</h3>
                      
                      <div className="space-y-4">
                        <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/10">
                          <div>
                            <div className="text-sm font-semibold text-white">Password Protection</div>
                            <div className="text-[10px] text-slate-400">Require password for subsequent logins</div>
                          </div>
                          <button
                            type="button"
                            onClick={() => setCompany(prev => ({ ...prev, passwordRequired: !(prev as any).passwordRequired }))}
                            className={`w-10 h-5 rounded-full transition-all relative ${(company as any).passwordRequired ? 'bg-blue-600' : 'bg-slate-700'}`}
                          >
                            <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${(company as any).passwordRequired ? 'left-6' : 'left-1'}`} />
                          </button>
                        </div>

                        <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/10">
                          <div>
                            <div className="text-sm font-semibold text-white">Complex Passwords</div>
                            <div className="text-[10px] text-slate-400">Enforce minimum length and complexity</div>
                          </div>
                          <button
                            type="button"
                            onClick={() => setCompany(prev => ({ ...prev, enforceComplexity: !(prev as any).enforceComplexity }))}
                            className={`w-10 h-5 rounded-full transition-all relative ${(company as any).enforceComplexity ? 'bg-blue-600' : 'bg-slate-700'}`}
                          >
                            <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${(company as any).enforceComplexity ? 'left-6' : 'left-1'}`} />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Navigation Footer */}
            <div className="px-6 py-4 bg-white/5 border-t border-white/10 flex items-center justify-between">
              <button
                type="button"
                onClick={() => goToStep(step - 1)}
                disabled={step === 0 || submitting}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-300 hover:text-white hover:bg-white/10 rounded-lg transition-all disabled:opacity-0 disabled:pointer-events-none"
              >
                <ArrowLeft size={16} />
                Back
              </button>

              {step < steps.length - 1 ? (
                <button
                  type="button"
                  onClick={() => {
                    if (step === 1 && !canContinueCompany) {
                      setError('Please complete all required fields.');
                      return;
                    }
                    if (step === 3 && !canContinueUser) {
                      setError('Please complete all required user information.');
                      return;
                    }
                    setError(null);
                    goToStep(step + 1);
                  }}
                  disabled={step === 0 && !setupMode}
                  className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 disabled:from-slate-600 disabled:to-slate-700 disabled:text-slate-400 text-white text-sm font-semibold rounded-xl shadow-lg shadow-blue-500/30 transition-all"
                >
                  Continue
                  <ArrowRight size={16} />
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={!canSubmitAdmin || submitting}
                  className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 disabled:from-slate-600 disabled:to-slate-700 disabled:text-slate-400 text-white text-sm font-semibold rounded-xl shadow-lg shadow-emerald-500/30 transition-all"
                >
                  {submitting ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Setting up...
                    </>
                  ) : (
                    <>
                      Complete Setup
                      <CheckCircle2 size={16} />
                    </>
                  )}
                </button>
              )}
            </div>
          </form>
        </div>

        {/* Step indicator dots */}
        <div className="flex justify-center gap-2 mt-6">
          {steps.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => i < step && goToStep(i)}
              disabled={i > step}
              className={`w-2 h-2 rounded-full transition-all duration-300 ${
                i === step
                  ? 'bg-blue-500 w-6'
                  : i < step
                    ? 'bg-blue-500/50 hover:bg-blue-500/70'
                    : 'bg-white/20'
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default SetupWizard;
