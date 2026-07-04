import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Zap, Users, Hash, Shield, Gamepad2, Sparkles, ArrowRight, ChevronRight, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';

const features = [
  {
    icon: Shield,
    title: 'Stay Anonymous',
    description: 'Your real identity stays hidden. Choose when and who to reveal yourself to.',
    gradient: 'from-purple-500/20 to-pink-500/20',
    iconColor: 'text-neon-purple',
  },
  {
    icon: Hash,
    title: 'Chat Rooms',
    description: '1000+ rooms for every interest. Lagos, Music, Football, Tech, and more.',
    gradient: 'from-blue-500/20 to-cyan-500/20',
    iconColor: 'text-neon-blue',
  },
  {
    icon: Gamepad2,
    title: 'Mini Games',
    description: 'Play Truth or Dare, Trivia, Meme Battles and more with new friends.',
    gradient: 'from-green-500/20 to-emerald-500/20',
    iconColor: 'text-neon-green',
  },
  {
    icon: Sparkles,
    title: 'AI Matchmaking',
    description: 'Our AI finds friends and groups that match your vibe and interests.',
    gradient: 'from-pink-500/20 to-rose-500/20',
    iconColor: 'text-neon-pink',
  },
];

const stats = [
  { value: '500K+', label: 'Cruisers' },
  { value: '1,200+', label: 'Active Rooms' },
  { value: '36', label: 'Nigerian States' },
  { value: '24/7', label: 'Always Live' },
];

const testimonials = [
  { username: 'ChillVibes_Ade', avatar: 'av3', text: 'CruiseHub is giving me life! I made 5 new friends this week alone.' },
  { username: 'LagosQueen', avatar: 'av5', text: 'Finally an app where I can be myself without judgment. My people are here!' },
  { username: 'NightOwl_Kemi', avatar: 'av7', text: 'The chat rooms are mad lit, especially the Night Owls room at 2am haha.' },
];

export function LandingPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      {/* Animated background orbs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/4 -left-32 w-96 h-96 rounded-full opacity-20 animate-orb"
          style={{ background: 'radial-gradient(circle, hsl(270 91% 65%), transparent)' }} />
        <div className="absolute bottom-1/4 -right-32 w-96 h-96 rounded-full opacity-15 animate-orb"
          style={{ background: 'radial-gradient(circle, hsl(330 100% 71%), transparent)', animationDelay: '4s' }} />
        <div className="absolute top-3/4 left-1/3 w-64 h-64 rounded-full opacity-10 animate-orb"
          style={{ background: 'radial-gradient(circle, hsl(210 100% 65%), transparent)', animationDelay: '2s' }} />
      </div>

      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-50 glass-strong border-b border-border">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg gradient-primary flex items-center justify-center">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <span className="text-lg font-bold gradient-text">CruiseHub</span>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate('/auth')}>
              Sign In
            </Button>
            <Button
              size="sm"
              className="gradient-primary text-white border-0 shadow-glow-purple hover:opacity-90"
              onClick={() => navigate('/auth?mode=register')}
            >
              Join Free
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative pt-28 pb-20 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="space-y-6"
          >
            <div className="inline-flex items-center gap-2 glass rounded-full px-4 py-2 text-sm font-medium border border-primary/20">
              <span className="w-2 h-2 rounded-full bg-neon-green animate-pulse" />
              <span className="text-primary">500K+ Nigerians are cruising right now</span>
            </div>

            <h1 className="text-5xl md:text-7xl font-bold leading-tight tracking-tight">
              <span className="gradient-text glow-text-purple">Cruise.</span>{' '}
              <span className="gradient-text glow-text-pink" style={{ backgroundImage: 'linear-gradient(135deg, hsl(330 100% 71%), hsl(270 91% 65%))' }}>
                Connect.
              </span>
              <br />
              <span className="text-foreground">Belong.</span>
            </h1>

            <p className="text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              Nigeria's most vibrant anonymous social platform. Make friends, join rooms, catch cruise, and be yourself — no judgment, no limits.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center pt-2">
              <Button
                size="lg"
                className="gradient-primary text-white border-0 shadow-glow-purple hover:opacity-90 text-base px-8 gap-2"
                onClick={() => navigate('/auth?mode=register')}
              >
                Start Cruising Free
                <ArrowRight className="w-5 h-5" />
              </Button>
              <Button
                variant="outline"
                size="lg"
                className="text-base px-8 gap-2"
                onClick={() => navigate('/auth')}
              >
                Sign In
              </Button>
            </div>
          </motion.div>

          {/* Hero preview card */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.3 }}
            className="mt-16 glass rounded-3xl p-6 max-w-md mx-auto neon-border"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-lg">😎</div>
              <div>
                <p className="font-semibold text-sm">@CruiserAde</p>
                <p className="text-xs text-neon-green">Online • Cruiser Level</p>
              </div>
              <span className="ml-auto text-xs text-muted-foreground">just now</span>
            </div>
            <div className="glass rounded-2xl p-3 text-sm text-foreground mb-3">
              "Lagos Crew room is mad lit tonight!! Anyone else watching the match? 🔥⚽"
            </div>
            <div className="flex gap-2">
              {['😂 24', '❤️ 18', '🔥 31'].map(r => (
                <span key={r} className="glass rounded-full px-3 py-1 text-xs font-medium">{r}</span>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* Stats */}
      <section className="py-12 px-4 border-y border-border">
        <div className="max-w-4xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8">
          {stats.map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="text-center"
            >
              <div className="text-3xl font-bold gradient-text mb-1">{stat.value}</div>
              <div className="text-sm text-muted-foreground">{stat.label}</div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="py-20 px-4">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-3">
              Everything You Need to <span className="gradient-text">Cruise</span>
            </h2>
            <p className="text-muted-foreground">Built for Naija youth, designed for vibes.</p>
          </div>
          <div className="grid sm:grid-cols-2 gap-5">
            {features.map((feature, i) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                className="glass rounded-2xl p-6 card-elevated group"
              >
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${feature.gradient} flex items-center justify-center mb-4`}>
                  <feature.icon className={`w-6 h-6 ${feature.iconColor}`} />
                </div>
                <h3 className="font-bold text-lg mb-2">{feature.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-20 px-4 bg-muted/30">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-10">
            What Cruisers Are Saying
          </h2>
          <div className="grid sm:grid-cols-3 gap-5">
            {testimonials.map((t, i) => (
              <motion.div
                key={t.username}
                initial={{ opacity: 0, scale: 0.95 }}
                whileInView={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.1 }}
                className="glass rounded-2xl p-5 space-y-3"
              >
                <div className="flex items-center gap-2">
                  {[1,2,3,4,5].map(s => <Star key={s} className="w-3.5 h-3.5 fill-neon-gold text-neon-gold" />)}
                </div>
                <p className="text-sm text-foreground italic">"{t.text}"</p>
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-xs">
                    {['😎','💖','⚡'][i]}
                  </div>
                  <span className="text-xs text-muted-foreground font-medium">@{t.username}</span>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          className="max-w-2xl mx-auto text-center glass rounded-3xl p-10 neon-border space-y-6"
        >
          <div className="text-5xl">🚀</div>
          <h2 className="text-3xl font-bold">
            Ready to Start <span className="gradient-text">Cruising?</span>
          </h2>
          <p className="text-muted-foreground">
            Join 500,000+ Nigerians. Free to join, always anonymous.
          </p>
          <Button
            size="lg"
            className="gradient-primary text-white border-0 shadow-glow-purple hover:opacity-90 text-base px-10 gap-2 animate-pulse-glow"
            onClick={() => navigate('/auth?mode=register')}
          >
            Join CruiseHub Free
            <ChevronRight className="w-5 h-5" />
          </Button>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8 px-4">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-primary" />
            <span className="font-bold gradient-text">CruiseHub</span>
          </div>
          <p className="text-sm text-muted-foreground">© 2025 CruiseHub. Made with love for Nigeria 🇳🇬</p>
          <div className="flex gap-4 text-sm text-muted-foreground">
            <a href="#" className="hover:text-primary transition-colors">Privacy</a>
            <a href="#" className="hover:text-primary transition-colors">Terms</a>
            <a href="#" className="hover:text-primary transition-colors">Safety</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
