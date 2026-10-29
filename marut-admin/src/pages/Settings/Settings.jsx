import { useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { UserRound, ShieldCheck, Mail, Check, Eye, EyeOff, LoaderCircle, LockKeyhole, Info, CheckCircle2, AlertCircle, Sparkles } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import './settings.css';

const emptyPasswords = { currentPassword: '', newPassword: '', confirmPassword: '' };
const displayNameFor = (user) => {
    const saved = user?.user_metadata?.display_name;
    if (typeof saved === 'string' && saved.trim()) return saved.trim();
    return user?.email?.split('@')[0]?.replace(/[._-]+/g, ' ').trim() || 'MARUT Admin';
};
const initialsFor = (name) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0].toUpperCase()).join('') || 'M';
const toast = (message) => window.dispatchEvent(new CustomEvent('marut-toast', { detail: message }));
function authError(error) {
    const message = error?.message || 'Something went wrong. Please try again.';
    if (/invalid login credentials/i.test(message)) return 'The current password is incorrect.';
    if (/password should be at least/i.test(message)) return 'Choose a longer password that meets the password requirements.';
    if (/same password/i.test(message)) return 'Your new password must be different from your current password.';
    if (/rate limit/i.test(message)) return 'Too many attempts. Please wait a little before trying again.';
    return message;
}

export default function SettingsPage() {
    const context = useOutletContext() || {};
    const [user, setUser] = useState(context.user || null);
    const [displayName, setDisplayName] = useState(displayNameFor(context.user));
    const [email, setEmail] = useState(context.user?.email || '');
    const [loading, setLoading] = useState(!context.user);
    const [savingName, setSavingName] = useState(false);
    const [nameError, setNameError] = useState('');
    const [nameSuccess, setNameSuccess] = useState('');
    const [passwords, setPasswords] = useState(emptyPasswords);
    const [savingPassword, setSavingPassword] = useState(false);
    const [passwordError, setPasswordError] = useState('');
    const [passwordSuccess, setPasswordSuccess] = useState('');
    const [visible, setVisible] = useState({ current: false, next: false, confirm: false });
    const currentName = useMemo(() => displayNameFor(user), [user]);

    useEffect(() => {
        let active = true;
        supabase.auth.getUser().then(({ data, error }) => {
            if (!active) return;
            if (error) setNameError(error.message || 'Unable to load account details.');
            if (data?.user) {
                setUser(data.user);
                setEmail(data.user.email || '');
                setDisplayName(displayNameFor(data.user));
            }
            setLoading(false);
        }).catch((error) => {
            if (active) { setNameError(error?.message || 'Unable to load account details.'); setLoading(false); }
        });
        return () => { active = false; };
    }, []);

    async function saveName(event) {
        event.preventDefault(); setNameError(''); setNameSuccess('');
        const name = displayName.trim();
        if (!name) return setNameError('Enter a display name.');
        if (name.length > 80) return setNameError('Display name must be 80 characters or fewer.');
        if (name === currentName) return setNameSuccess('Your display name is already up to date.');
        setSavingName(true);
        try {
            const { data, error } = await supabase.auth.updateUser({ data: { display_name: name } });
            if (error) throw error;
            if (data?.user) {
                setUser(data.user); setEmail(data.user.email || ''); setDisplayName(displayNameFor(data.user));
            }
            setNameSuccess('Display name updated successfully.'); toast('Display name updated');
        } catch (error) { setNameError(authError(error)); }
        finally { setSavingName(false); }
    }

    const updatePassword = (key, value) => {
        setPasswords((current) => ({ ...current, [key]: value }));
        setPasswordError(''); setPasswordSuccess('');
    };

    async function savePassword(event) {
        event.preventDefault(); setPasswordError(''); setPasswordSuccess('');
        const { currentPassword, newPassword, confirmPassword } = passwords;
        if (!currentPassword || !newPassword || !confirmPassword) return setPasswordError('Complete all three password fields.');
        if (newPassword.length < 8) return setPasswordError('Your new password must be at least 8 characters long.');
        if (newPassword !== confirmPassword) return setPasswordError('The new password and confirmation do not match.');
        if (currentPassword === newPassword) return setPasswordError('Your new password must be different from your current password.');
        if (!user?.email) return setPasswordError('We could not identify the email for this account. Refresh and try again.');
        setSavingPassword(true);
        try {
            const { error: verifyError } = await supabase.auth.signInWithPassword({ email: user.email, password: currentPassword });
            if (verifyError) throw verifyError;
            const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
            if (updateError) throw updateError;
            setPasswords(emptyPasswords); setVisible({ current: false, next: false, confirm: false });
            setPasswordSuccess('Password changed successfully.'); toast('Password changed successfully');
        } catch (error) { setPasswordError(authError(error)); }
        finally { setSavingPassword(false); }
    }

    return <div className="settings-page">
        <header className="settings-heading">
            <div><div className="settings-eyebrow"><Sparkles size={13} /> YOUR WORKSPACE</div><h1>Settings</h1><p>Manage your personal profile and account security.</p></div>
        </header>
        <div className="settings-layout">
            <aside className="settings-nav" aria-label="Settings sections">
                <a className="settings-nav-item active" href="#profile"><UserRound size={17} /> Profile</a>
                <a className="settings-nav-item" href="#security"><ShieldCheck size={17} /> Security</a>
                <div className="settings-nav-note"><LockKeyhole size={16} /><span>Your account details are managed securely through Supabase Auth.</span></div>
            </aside>
            <div className="settings-content">
                <section className="settings-card" id="profile">
                    <div className="settings-card-heading"><div className="settings-section-icon"><UserRound size={19} /></div><div><h2>Personal profile</h2><p>Choose how your name appears in MARUT Admin.</p></div></div>
                    <div className="settings-identity"><div className="settings-large-avatar">{initialsFor(displayName.trim() || currentName)}</div><div className="settings-identity-copy"><strong>{displayName.trim() || currentName}</strong><span>{email || 'Signed-in account'}</span><small>Personal display name</small></div></div>
                    <form onSubmit={saveName} className="settings-form">
                        <label className="settings-label" htmlFor="display-name">Display name</label>
                        <input id="display-name" className="settings-input" type="text" autoComplete="nickname" maxLength={80} value={displayName} onChange={(e) => { setDisplayName(e.target.value); setNameError(''); setNameSuccess(''); }} placeholder="e.g. Anirudh" disabled={loading || savingName} required />
                        <div className="settings-field-hint">This changes your personal display name only. It does not change your login email or admin permissions.</div>
                        {nameError && <Feedback type="error" message={nameError} />}{nameSuccess && <Feedback type="success" message={nameSuccess} />}
                        <div className="settings-form-actions"><button className="settings-button primary" type="submit" disabled={loading || savingName || !displayName.trim()}>{savingName ? <LoaderCircle className="settings-spinner" size={16} /> : <Check size={16} />}{savingName ? 'Saving…' : 'Save changes'}</button></div>
                    </form>
                </section>
                <section className="settings-card" id="security">
                    <div className="settings-card-heading"><div className="settings-section-icon"><ShieldCheck size={19} /></div><div><h2>Password &amp; security</h2><p>Change your password to keep your account secure.</p></div></div>
                    <div className="settings-security-note"><Info size={17} /><p>For your protection, we’ll verify your current password before saving a new one.</p></div>
                    <form onSubmit={savePassword} className="settings-form">
                        <PasswordField id="current-password" label="Current password" value={passwords.currentPassword} visible={visible.current} autoComplete="current-password" onChange={(v) => updatePassword('currentPassword', v)} onToggle={() => setVisible((v) => ({ ...v, current: !v.current }))} disabled={savingPassword} />
                        <div className="settings-password-divider" />
                        <PasswordField id="new-password" label="New password" value={passwords.newPassword} visible={visible.next} autoComplete="new-password" onChange={(v) => updatePassword('newPassword', v)} onToggle={() => setVisible((v) => ({ ...v, next: !v.next }))} disabled={savingPassword} hint="Use at least 8 characters. A longer, unique password is recommended." />
                        <PasswordField id="confirm-password" label="Confirm new password" value={passwords.confirmPassword} visible={visible.confirm} autoComplete="new-password" onChange={(v) => updatePassword('confirmPassword', v)} onToggle={() => setVisible((v) => ({ ...v, confirm: !v.confirm }))} disabled={savingPassword} />
                        {passwordError && <Feedback type="error" message={passwordError} />}{passwordSuccess && <Feedback type="success" message={passwordSuccess} />}
                        <div className="settings-form-actions"><button className="settings-button primary" type="submit" disabled={savingPassword}>{savingPassword ? <LoaderCircle className="settings-spinner" size={16} /> : <LockKeyhole size={16} />}{savingPassword ? 'Updating password…' : 'Update password'}</button></div>
                    </form>
                </section>
                <section className="settings-card settings-account-card"><div className="settings-card-heading"><div className="settings-section-icon"><Mail size={19} /></div><div><h2>Account information</h2><p>Your sign-in identity. Email changes are not included in this settings flow.</p></div></div><div className="settings-account-row"><span>Email address</span><strong>{email || '—'}</strong><span className="settings-readonly-pill">Read only</span></div></section>
                <p className="settings-footer-note">MARUT Admin · Personal settings</p>
            </div>
        </div>
    </div>;
}

function PasswordField({ id, label, value, visible, autoComplete, onChange, onToggle, disabled, hint }) {
    return <div className="settings-password-field"><label className="settings-label" htmlFor={id}>{label}</label><div className="settings-password-wrap"><input id={id} className="settings-input" type={visible ? 'text' : 'password'} autoComplete={autoComplete} value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled} required /><button className="settings-password-toggle" type="button" onClick={onToggle} aria-label={visible ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`} disabled={disabled}>{visible ? <EyeOff size={17} /> : <Eye size={17} />}</button></div>{hint && <div className="settings-field-hint">{hint}</div>}</div>;
}
function Feedback({ type, message }) {
    const Icon = type === 'success' ? CheckCircle2 : AlertCircle;
    return <div className={`settings-feedback ${type}`} role={type === 'error' ? 'alert' : 'status'}><Icon size={16} /><span>{message}</span></div>;
}
