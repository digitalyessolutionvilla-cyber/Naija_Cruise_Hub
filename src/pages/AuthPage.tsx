import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Zap, Eye, EyeOff, ChevronRight, ChevronLeft, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/context/AuthContext';
import { AVATARS, INTERESTS, NIGERIAN_STATES } from '@/types';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

const registerStep1Schema = z.object({
  username: z.string().min(3, 'Username must be at least 3 characters').max(20).regex(/^[a-zA-Z0-9_]+$/, 'Only letters, numbers, and underscores'),
  email: z.string().email('Invalid email'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

type LoginData = z.infer<typeof loginSchema>;
type RegStep1Data = z.infer<typeof registerStep1Schema>;

interface RegData {
  username: string;
  email: string;
  password: string;
  dob: string;
  gender: string;
  state: string;
  interests: string[];
  avatar_id: string;
}

const STEPS = ['Account', 'Profile', 'Location', 'Avatar'];
const SIGNUP_RATE_LIMIT_KEY = 'cruisehub_signup_retry_after';

function getAuthErrorMessage(error: Error, action: 'signin' | 'signup') {
  const message = (error.message || '').toLowerCase();

  if (message.includes('email not confirmed')) {
    return 'Email not confirmed. Check your inbox/spam for the confirmation link, or ask admin to confirm your account in Supabase Auth Users.';
  }

  if (message.includes('rate limit') || message.includes('too many requests')) {
    if (action === 'signup') {
      return 'Registration is temporarily rate-limited. Wait about 60 seconds and try again. If you already signed up, try signing in instead.';
    }
    return 'Too many sign-in attempts. Wait about 60 seconds and try again.';
  }

  return error.message;
}

function isRateLimitedError(error: Error) {
  const message = (error.message || '').toLowerCase();
  return message.includes('rate limit') || message.includes('too many requests');
}

export function AuthPage() {
  const [searchParams] = useSearchParams();
  const [isLogin, setIsLogin] = useState(searchParams.get('mode') !== 'register');
  const [step, setStep] = useState(0);
  const [showPw, setShowPw] = useState(false);
  const [regData, setRegData] = useState<Partial<RegData>>({ interests: [], avatar_id: 'av1' });
  const [loading, setLoading] = useState(false);
  const { signIn, signUp, user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) navigate('/home');
  }, [user, navigate]);

  const loginForm = useForm<LoginData>({ resolver: zodResolver(loginSchema) });
  const reg1Form = useForm<RegStep1Data>({ resolver: zodResolver(registerStep1Schema) });

  const handleLogin = async (data: LoginData) => {
    setLoading(true);
    const { error } = await signIn(data.email, data.password);
    setLoading(false);
    if (error) {
      toast.error('Sign in failed: ' + getAuthErrorMessage(error, 'signin'));
    } else {
      const next = searchParams.get('next');
      navigate(next && next.startsWith('/') ? next : '/home');
    }
  };

  const handleReg1 = async (data: RegStep1Data) => {
    setRegData(prev => ({ ...prev, ...data }));
    setStep(1);
  };

  const handleReg2 = () => {
    if (!regData.gender || !regData.dob) {
      toast.error('Please fill in all fields');
      return;
    }
    setStep(2);
  };

  const handleReg3 = () => {
    if (!regData.state) {
      toast.error('Please select your state');
      return;
    }
    setStep(3);
  };

  const handleFinalSubmit = async () => {
    const retryAtRaw = localStorage.getItem(SIGNUP_RATE_LIMIT_KEY);
    const retryAt = retryAtRaw ? Number(retryAtRaw) : 0;
    if (Number.isFinite(retryAt) && retryAt > Date.now()) {
      const secondsLeft = Math.ceil((retryAt - Date.now()) / 1000);
      toast.error(`Registration is temporarily rate-limited. Try again in about ${secondsLeft}s.`);
      return;
    }

    setLoading(true);
    const email = regData.email!;
    const password = regData.password!;
    const { error } = await signUp(email, password, regData.username!);
    if (error) {
      if (isRateLimitedError(error)) {
        localStorage.setItem(SIGNUP_RATE_LIMIT_KEY, String(Date.now() + 65_000));

        // If account creation already happened previously, sign-in can still succeed.
        const signInAttempt = await signIn(email, password);
        if (!signInAttempt.error) {
          localStorage.removeItem(SIGNUP_RATE_LIMIT_KEY);
          toast.success('Account already exists and you are now signed in.');
          navigate('/home');
          setLoading(false);
          return;
        }
      }

      toast.error('Registration failed: ' + getAuthErrorMessage(error, 'signup'));
      setLoading(false);
      return;
    }
    localStorage.removeItem(SIGNUP_RATE_LIMIT_KEY);
    // Update profile with additional data
    toast.success('Welcome to CruiseHub! 🎉');
    navigate('/home');
    setLoading(false);
  };

  const toggleInterest = (interest: string) => {
    setRegData(prev => ({
      ...prev,
      interests: prev.interests?.includes(interest)
        ? prev.interests.filter(i => i !== interest)
        : [...(prev.interests || []), interest],
    }));
  };

  return (
    <div className="min-h-screen bg-background bg-mesh flex items-center justify-center p-4">
      {/* Background orbs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/3 -left-20 w-80 h-80 rounded-full opacity-20 animate-orb"
          style={{ background: 'radial-gradient(circle, hsl(270 91% 65%), transparent)' }} />
        <div className="absolute bottom-1/3 -right-20 w-80 h-80 rounded-full opacity-15 animate-orb"
          style={{ background: 'radial-gradient(circle, hsl(330 100% 71%), transparent)', animationDelay: '4s' }} />
      </div>

      <div className="w-full max-w-md relative z-10">
        {/* Logo */}
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center shadow-glow-purple">
            <Zap className="w-6 h-6 text-white" />
          </div>
          <span className="text-2xl font-bold gradient-text">CruiseHub</span>
        </div>

        <div className="glass rounded-3xl p-6 neon-border shadow-elegant">
          {/* Toggle */}
          <div className="flex bg-muted rounded-xl p-1 mb-6">
            <button
              className={cn('flex-1 py-2 text-sm font-semibold rounded-lg transition-smooth',
                isLogin ? 'bg-card text-foreground shadow-card' : 'text-muted-foreground')}
              onClick={() => { setIsLogin(true); setStep(0); }}
            >
              Sign In
            </button>
            <button
              className={cn('flex-1 py-2 text-sm font-semibold rounded-lg transition-smooth',
                !isLogin ? 'bg-card text-foreground shadow-card' : 'text-muted-foreground')}
              onClick={() => { setIsLogin(false); setStep(0); }}
            >
              Join Free
            </button>
          </div>

          <AnimatePresence mode="wait">
            {isLogin ? (
              <motion.div
                key="login"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="space-y-4"
              >
                <h2 className="text-xl font-bold">Welcome back!</h2>
                <form onSubmit={loginForm.handleSubmit(handleLogin)} className="space-y-4">
                  <div>
                    <Label>Email</Label>
                    <Input {...loginForm.register('email')} type="email" placeholder="your@email.com" className="mt-1" />
                    {loginForm.formState.errors.email && (
                      <p className="text-destructive text-xs mt-1">{loginForm.formState.errors.email.message}</p>
                    )}
                  </div>
                  <div>
                    <Label>Password</Label>
                    <div className="relative mt-1">
                      <Input {...loginForm.register('password')} type={showPw ? 'text' : 'password'} placeholder="••••••••" />
                      <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                        onClick={() => setShowPw(p => !p)}>
                        {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    {loginForm.formState.errors.password && (
                      <p className="text-destructive text-xs mt-1">{loginForm.formState.errors.password.message}</p>
                    )}
                  </div>
                  <Button type="submit" className="w-full gradient-primary text-white border-0 shadow-glow-purple" disabled={loading}>
                    {loading ? 'Signing in...' : 'Sign In'}
                  </Button>
                </form>
              </motion.div>
            ) : (
              <motion.div key="register" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                {/* Progress steps */}
                <div className="flex items-center justify-between mb-6">
                  {STEPS.map((s, i) => (
                    <div key={s} className="flex items-center">
                      <div className={cn(
                        'w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-smooth',
                        i < step ? 'gradient-primary text-white' :
                          i === step ? 'bg-primary/20 text-primary border border-primary' :
                            'bg-muted text-muted-foreground'
                      )}>
                        {i < step ? <Check className="w-3.5 h-3.5" /> : i + 1}
                      </div>
                      {i < STEPS.length - 1 && (
                        <div className={cn('h-0.5 w-8 mx-1 transition-smooth', i < step ? 'bg-primary' : 'bg-muted')} />
                      )}
                    </div>
                  ))}
                </div>

                <AnimatePresence mode="wait">
                  {step === 0 && (
                    <motion.div key="s0" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
                      <h2 className="text-xl font-bold">Create your account</h2>
                      <form onSubmit={reg1Form.handleSubmit(handleReg1)} className="space-y-3">
                        <div>
                          <Label>Username</Label>
                          <Input {...reg1Form.register('username')} placeholder="CoolCruiser123" className="mt-1" />
                          {reg1Form.formState.errors.username && <p className="text-destructive text-xs mt-1">{reg1Form.formState.errors.username.message}</p>}
                        </div>
                        <div>
                          <Label>Email</Label>
                          <Input {...reg1Form.register('email')} type="email" placeholder="your@email.com" className="mt-1" />
                          {reg1Form.formState.errors.email && <p className="text-destructive text-xs mt-1">{reg1Form.formState.errors.email.message}</p>}
                        </div>
                        <div>
                          <Label>Password</Label>
                          <div className="relative mt-1">
                            <Input {...reg1Form.register('password')} type={showPw ? 'text' : 'password'} placeholder="Min 8 characters" />
                            <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" onClick={() => setShowPw(p => !p)}>
                              {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                          </div>
                          {reg1Form.formState.errors.password && <p className="text-destructive text-xs mt-1">{reg1Form.formState.errors.password.message}</p>}
                        </div>
                        <Button type="submit" className="w-full gradient-primary text-white border-0 mt-2 gap-2">
                          Continue <ChevronRight className="w-4 h-4" />
                        </Button>
                      </form>
                    </motion.div>
                  )}

                  {step === 1 && (
                    <motion.div key="s1" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
                      <h2 className="text-xl font-bold">Tell us about yourself</h2>
                      <div>
                        <Label>Date of Birth</Label>
                        <Input type="date" className="mt-1" onChange={e => setRegData(p => ({ ...p, dob: e.target.value }))} />
                      </div>
                      <div>
                        <Label>Gender</Label>
                        <div className="flex gap-2 mt-1">
                          {['Male', 'Female', 'Prefer not to say'].map(g => (
                            <button key={g} type="button"
                              className={cn('flex-1 py-2 rounded-xl text-sm border transition-smooth',
                                regData.gender === g ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-muted/30 text-muted-foreground')}
                              onClick={() => setRegData(p => ({ ...p, gender: g }))}>
                              {g}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="flex gap-2 pt-2">
                        <Button variant="outline" className="flex-1 gap-2" onClick={() => setStep(0)}>
                          <ChevronLeft className="w-4 h-4" /> Back
                        </Button>
                        <Button className="flex-1 gradient-primary text-white border-0 gap-2" onClick={handleReg2}>
                          Continue <ChevronRight className="w-4 h-4" />
                        </Button>
                      </div>
                    </motion.div>
                  )}

                  {step === 2 && (
                    <motion.div key="s2" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
                      <h2 className="text-xl font-bold">Where are you from?</h2>
                      <div>
                        <Label>State</Label>
                        <select
                          className="w-full mt-1 h-10 px-3 rounded-lg border border-input bg-background text-sm"
                          value={regData.state || ''}
                          onChange={e => setRegData(p => ({ ...p, state: e.target.value }))}
                        >
                          <option value="">Select your state</option>
                          {NIGERIAN_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </div>
                      <div>
                        <Label className="mb-2 block">Interests (pick up to 5)</Label>
                        <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto">
                          {INTERESTS.map(interest => (
                            <button key={interest} type="button"
                              className={cn('px-3 py-1.5 rounded-full text-xs font-medium border transition-smooth',
                                regData.interests?.includes(interest)
                                  ? 'bg-primary/15 border-primary text-primary'
                                  : 'border-border text-muted-foreground hover:border-primary/50')}
                              onClick={() => toggleInterest(interest)}
                              disabled={(regData.interests?.length || 0) >= 5 && !regData.interests?.includes(interest)}>
                              {interest}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="flex gap-2 pt-2">
                        <Button variant="outline" className="flex-1 gap-2" onClick={() => setStep(1)}>
                          <ChevronLeft className="w-4 h-4" /> Back
                        </Button>
                        <Button className="flex-1 gradient-primary text-white border-0 gap-2" onClick={handleReg3}>
                          Continue <ChevronRight className="w-4 h-4" />
                        </Button>
                      </div>
                    </motion.div>
                  )}

                  {step === 3 && (
                    <motion.div key="s3" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
                      <h2 className="text-xl font-bold">Pick your avatar</h2>
                      <p className="text-sm text-muted-foreground">Your anonymous identity on CruiseHub</p>
                      <div className="grid grid-cols-4 gap-3">
                        {AVATARS.map(avatar => (
                          <button key={avatar.id} type="button"
                            className={cn('relative rounded-2xl p-1 transition-smooth',
                              regData.avatar_id === avatar.id ? 'ring-2 ring-primary ring-offset-2 ring-offset-background' : '')}
                            onClick={() => setRegData(p => ({ ...p, avatar_id: avatar.id }))}>
                            <div className={`w-full aspect-square rounded-xl bg-gradient-to-br ${avatar.gradient} flex items-center justify-center text-2xl`}>
                              {avatar.emoji}
                            </div>
                            {regData.avatar_id === avatar.id && (
                              <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full gradient-primary flex items-center justify-center">
                                <Check className="w-3 h-3 text-white" />
                              </div>
                            )}
                          </button>
                        ))}
                      </div>
                      <div className="flex gap-2 pt-2">
                        <Button variant="outline" className="flex-1 gap-2" onClick={() => setStep(2)}>
                          <ChevronLeft className="w-4 h-4" /> Back
                        </Button>
                        <Button className="flex-1 gradient-primary text-white border-0 shadow-glow-purple gap-2" onClick={handleFinalSubmit} disabled={loading}>
                          {loading ? 'Creating account...' : 'Start Cruising!'} {!loading && <Zap className="w-4 h-4" />}
                        </Button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <p className="text-center text-xs text-muted-foreground mt-6">
          By joining, you agree to our{' '}
          <a href="#" className="text-primary hover:underline">Terms</a> and{' '}
          <a href="#" className="text-primary hover:underline">Privacy Policy</a>
        </p>
      </div>
    </div>
  );
}
