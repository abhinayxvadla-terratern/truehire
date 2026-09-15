import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { Eye, EyeOff } from 'lucide-react';
import { AuthLayout } from '../components/layout/AuthLayout';
import { notifyByRole } from '../utils/notificationRouting';

type RoleOption = 'candidate' | 'supplier' | 'employer';

export const Register: React.FC = () => {
  const [searchParams] = useSearchParams();
  const inviteToken = searchParams.get('token');
  const roleParam = searchParams.get('role') as RoleOption | null;
  const urlFirstName = searchParams.get('firstName') || '';
  const urlLastName = searchParams.get('lastName') || '';

  const [selectedRole, setSelectedRole] = useState<RoleOption>(
    inviteToken
      ? 'candidate'
      : roleParam === 'employer' || roleParam === 'supplier'
      ? roleParam
      : 'candidate'
  );

  // Form Fields
  const [firstName, setFirstName] = useState(urlFirstName);
  const [lastName, setLastName] = useState(urlLastName);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Role-specific fields
  const [companyName, setCompanyName] = useState('');
  const [companyType, setCompanyType] = useState<string>('placement_agency');
  const [companyLocation, setCompanyLocation] = useState('');

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  const navigate = useNavigate();
  const { refreshSession } = useAuth();

  useEffect(() => {
    if (inviteToken) {
      setSelectedRole('candidate');
      if (urlFirstName) setFirstName(urlFirstName);
      if (urlLastName) setLastName(urlLastName);
    } else if (roleParam === 'candidate' || roleParam === 'employer' || roleParam === 'supplier') {
      setSelectedRole(roleParam);
    }
  }, [inviteToken, roleParam, urlFirstName, urlLastName]);

  const handleRoleChange = (role: RoleOption) => {
    setSelectedRole(role);
    setErrorMessage(null);
    navigate(`/register?role=${role}`, { replace: true });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setInfoMessage(null);

    if (!firstName.trim() || !lastName.trim() || !email.trim() || !password) {
      setErrorMessage('All required fields must be filled.');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match.');
      return;
    }

    if (password.length < 6) {
      setErrorMessage('Password must be at least 6 characters.');
      return;
    }

    if (selectedRole === 'supplier') {
      if (!companyName.trim() || !companyType) {
        setErrorMessage('Provide company or academy name and type.');
        return;
      }
    }

    if (selectedRole === 'employer') {
      if (!companyName.trim() || !companyLocation.trim()) {
        setErrorMessage('Provide hospital/facility name and German location.');
        return;
      }
    }

    try {
      setLoading(true);

      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            first_name: firstName.trim(),
            last_name: lastName.trim(),
            role: selectedRole,
            company_name: companyName.trim(),
            company_type: companyType,
            location: companyLocation.trim(),
            invite_token: inviteToken || null,
          },
        },
      });

      if (authError) {
        setErrorMessage(authError.message || 'Registration failed.');
        setLoading(false);
        return;
      }

      const user = authData.user;
      if (!user) {
        setErrorMessage('Account creation failed. Try again.');
        setLoading(false);
        return;
      }

      if (user.identities && user.identities.length === 0) {
        setErrorMessage('An account with this email already exists. Sign in instead.');
        setLoading(false);
        return;
      }

      if (!authData.session) {
        const { error: signInErr } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (signInErr) {
          console.warn('Sign-in after registration notice:', signInErr);
        }
      }

      try {
        await supabase.from('profiles').upsert(
          {
            id: user.id,
            role: selectedRole,
            first_name: firstName.trim(),
            last_name: lastName.trim(),
            email: email.trim(),
          },
          { onConflict: 'id' }
        );
      } catch (profErr) {
        console.warn('Profile upsert notice (handled by DB trigger):', profErr);
      }

      try {
        if (selectedRole === 'candidate') {
          if (inviteToken) {
            await supabase.rpc('claim_invite_token', {
              p_token: inviteToken,
              p_user_id: user.id,
            });
          } else {
            await supabase.from('candidates').upsert(
              {
                user_id: user.id,
                first_name: firstName.trim(),
                last_name: lastName.trim(),
                status: 'onboarding',
              },
              { onConflict: 'user_id' }
            );
          }
        } else if (selectedRole === 'supplier') {
          await supabase.from('suppliers').upsert(
            {
              user_id: user.id,
              company_name: companyName.trim(),
              company_type: companyType,
            },
            { onConflict: 'user_id' }
          );
          await notifyByRole(
            supabase,
            'placement_lead',
            'New Supplier Account Created',
            `A new supplier partner "${companyName.trim()}" has registered. Assign an Account Manager.`,
            'supplier_onboarding',
            user.id
          );
        } else if (selectedRole === 'employer') {
          await supabase.from('employers').upsert(
            {
              user_id: user.id,
              company_name: companyName.trim(),
              location: companyLocation.trim(),
            },
            { onConflict: 'user_id' }
          );
          await notifyByRole(
            supabase,
            'placement_lead',
            'New Employer Account Created',
            `A new healthcare employer "${companyName.trim()}" has registered. Assign an Account Manager.`,
            'employer_onboarding',
            user.id
          );
        }
      } catch (roleErr) {
        console.warn('Role record upsert notice (handled by DB trigger):', roleErr);
      }

      await refreshSession();

      switch (selectedRole) {
        case 'candidate':
          navigate('/candidate', { replace: true });
          break;
        case 'supplier':
          navigate('/supplier', { replace: true });
          break;
        case 'employer':
          navigate('/employer', { replace: true });
          break;
        default:
          navigate('/', { replace: true });
      }
    } catch (err: any) {
      console.error('Registration exception:', err);
      setErrorMessage(err.message || 'An unexpected error occurred during registration.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Create account"
      subtitle="Join the TerraTern healthcare mobility network"
      bottomLinks={
        <div>
          Already have an account?{' '}
          <Link
            to={`/login?role=${selectedRole}`}
            className="text-[#2952A3] font-medium hover:underline"
          >
            Sign in
          </Link>
        </div>
      }
    >
      {/* Role selector tabs */}
      {!inviteToken && (
        <div className="flex bg-[#F8FAFD] p-1 rounded-[8px] border border-[#E2E8F4] mb-5">
          {(['candidate', 'employer', 'supplier'] as const).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => handleRoleChange(r)}
              className={`flex-1 py-1.5 text-[12px] font-medium rounded-[6px] capitalize transition-all cursor-pointer ${
                selectedRole === r
                  ? 'bg-white text-[#1B3270] shadow-xs font-semibold'
                  : 'text-[#94A3B8] hover:text-[#4A5568]'
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      )}

      {infoMessage ? (
        <div className="space-y-4">
          <div className="text-[13px] text-[#166534] bg-[#F0FDF4] border border-[#10B981]/20 rounded-[8px] p-3 text-center">
            {infoMessage}
          </div>
          <Link
            to={`/login?role=${selectedRole}`}
            className="block w-full h-[44px] leading-[44px] text-center bg-[#1B3270] hover:bg-[#2952A3] text-white text-[14px] font-semibold rounded-[8px] transition-colors duration-150"
          >
            Sign in
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-3.5">
          {/* First & Last Name */}
          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="block text-[12px] font-medium text-[#1B3270] mb-1">
                First Name
              </label>
              <input
                type="text"
                required
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="e.g. Maria"
                className="w-full h-[44px] px-3.5 text-[14px] bg-white border-[1.5px] border-[#E2E8F4] rounded-[8px] text-[#1B3270] placeholder-[#94A3B8] outline-none transition-all duration-150 focus:border-[#1B3270] focus:ring-3 focus:ring-[#1B3270]/10"
              />
            </div>
            <div>
              <label className="block text-[12px] font-medium text-[#1B3270] mb-1">
                Last Name
              </label>
              <input
                type="text"
                required
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="e.g. Santos"
                className="w-full h-[44px] px-3.5 text-[14px] bg-white border-[1.5px] border-[#E2E8F4] rounded-[8px] text-[#1B3270] placeholder-[#94A3B8] outline-none transition-all duration-150 focus:border-[#1B3270] focus:ring-3 focus:ring-[#1B3270]/10"
              />
            </div>
          </div>

          {/* Email */}
          <div>
            <label className="block text-[12px] font-medium text-[#1B3270] mb-1">
              Email Address
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="e.g. name@example.com"
              className="w-full h-[44px] px-3.5 text-[14px] bg-white border-[1.5px] border-[#E2E8F4] rounded-[8px] text-[#1B3270] placeholder-[#94A3B8] outline-none transition-all duration-150 focus:border-[#1B3270] focus:ring-3 focus:ring-[#1B3270]/10"
            />
          </div>

          {/* Role = Supplier Fields */}
          {selectedRole === 'supplier' && (
            <>
              <div>
                <label className="block text-[12px] font-medium text-[#1B3270] mb-1">
                  Company or Academy Name
                </label>
                <input
                  type="text"
                  required
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="e.g. Apex Nursing Academy"
                  className="w-full h-[44px] px-3.5 text-[14px] bg-white border-[1.5px] border-[#E2E8F4] rounded-[8px] text-[#1B3270] placeholder-[#94A3B8] outline-none transition-all duration-150 focus:border-[#1B3270] focus:ring-3 focus:ring-[#1B3270]/10"
                />
              </div>
              <div>
                <label className="block text-[12px] font-medium text-[#1B3270] mb-1">
                  Company Type
                </label>
                <select
                  value={companyType}
                  onChange={(e) => setCompanyType(e.target.value)}
                  className="w-full h-[44px] px-3.5 text-[14px] bg-white border-[1.5px] border-[#E2E8F4] rounded-[8px] text-[#1B3270] outline-none transition-all duration-150 focus:border-[#1B3270] focus:ring-3 focus:ring-[#1B3270]/10 cursor-pointer"
                >
                  <option value="placement_agency">Placement Agency</option>
                  <option value="language_school">Language School</option>
                  <option value="training_center">Training Center</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </>
          )}

          {/* Role = Employer Fields */}
          {selectedRole === 'employer' && (
            <>
              <div>
                <label className="block text-[12px] font-medium text-[#1B3270] mb-1">
                  Hospital or Facility Name
                </label>
                <input
                  type="text"
                  required
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="e.g. Klinikum Frankfurt"
                  className="w-full h-[44px] px-3.5 text-[14px] bg-white border-[1.5px] border-[#E2E8F4] rounded-[8px] text-[#1B3270] placeholder-[#94A3B8] outline-none transition-all duration-150 focus:border-[#1B3270] focus:ring-3 focus:ring-[#1B3270]/10"
                />
              </div>
              <div>
                <label className="block text-[12px] font-medium text-[#1B3270] mb-1">
                  Location in Germany
                </label>
                <input
                  type="text"
                  required
                  value={companyLocation}
                  onChange={(e) => setCompanyLocation(e.target.value)}
                  placeholder="e.g. Frankfurt am Main"
                  className="w-full h-[44px] px-3.5 text-[14px] bg-white border-[1.5px] border-[#E2E8F4] rounded-[8px] text-[#1B3270] placeholder-[#94A3B8] outline-none transition-all duration-150 focus:border-[#1B3270] focus:ring-3 focus:ring-[#1B3270]/10"
                />
              </div>
            </>
          )}

          {/* Password */}
          <div>
            <label className="block text-[12px] font-medium text-[#1B3270] mb-1">
              Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 6 characters"
                className="w-full h-[44px] px-3.5 pr-10 text-[14px] bg-white border-[1.5px] border-[#E2E8F4] rounded-[8px] text-[#1B3270] placeholder-[#94A3B8] outline-none transition-all duration-150 focus:border-[#1B3270] focus:ring-3 focus:ring-[#1B3270]/10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-[#94A3B8] hover:text-[#4A5568] cursor-pointer"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff size={16} strokeWidth={1.5} /> : <Eye size={16} strokeWidth={1.5} />}
              </button>
            </div>
          </div>

          {/* Confirm Password */}
          <div>
            <label className="block text-[12px] font-medium text-[#1B3270] mb-1">
              Confirm Password
            </label>
            <input
              type={showPassword ? 'text' : 'password'}
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Re-enter password"
              className="w-full h-[44px] px-3.5 text-[14px] bg-white border-[1.5px] border-[#E2E8F4] rounded-[8px] text-[#1B3270] placeholder-[#94A3B8] outline-none transition-all duration-150 focus:border-[#1B3270] focus:ring-3 focus:ring-[#1B3270]/10"
            />
          </div>

          {/* Inline Error Display */}
          {errorMessage && (
            <div className="text-[12px] text-[#EF4444] bg-[#FEF2F2] border border-[#EF4444]/20 rounded-[8px] p-2.5">
              {errorMessage}
            </div>
          )}

          {/* Create Account Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full h-[44px] bg-[#1B3270] hover:bg-[#2952A3] text-white text-[14px] font-semibold rounded-[8px] transition-colors duration-150 shadow-xs disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center cursor-pointer mt-5"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <span>Create Account</span>
            )}
          </button>
        </form>
      )}
    </AuthLayout>
  );
};

export default Register;
