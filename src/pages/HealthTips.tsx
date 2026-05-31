import { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { healthTips, getTipsByCategory, getDailyTip } from '@/data/healthTips';
import { HealthTip } from '@/types';
import { 
  Heart, 
  Apple, 
  Dumbbell, 
  Brain, 
  Moon,
  Sparkles
} from 'lucide-react';
import { cn } from '@/lib/utils';

const categories = [
  { id: 'all', label: 'All Tips', icon: Sparkles },
  { id: 'diet', label: 'Diet', icon: Apple },
  { id: 'exercise', label: 'Exercise', icon: Dumbbell },
  { id: 'mental-health', label: 'Mental Health', icon: Brain },
  { id: 'sleep', label: 'Sleep', icon: Moon },
];

const HealthTips = () => {
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const dailyTip = getDailyTip();

  const filteredTips = activeCategory === 'all' 
    ? healthTips 
    : getTipsByCategory(activeCategory as HealthTip['category']);

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'diet':
        return 'bg-success/10 text-success';
      case 'exercise':
        return 'bg-info/10 text-info';
      case 'mental-health':
        return 'bg-warning/10 text-warning';
      case 'sleep':
        return 'bg-primary/10 text-primary';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8 animate-fade-up">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-destructive/10 text-destructive mb-4">
            <Heart size={32} />
          </div>
          <h1 className="text-3xl font-bold text-foreground">Health Tips</h1>
          <p className="text-muted-foreground mt-1">
            Daily tips to improve your health and wellness
          </p>
        </div>

        {/* Daily Tip Highlight */}
        <div className="card-medical border-l-4 border-l-primary mb-8 animate-fade-up" style={{ animationDelay: '100ms' }}>
          <div className="flex items-start gap-4">
            <div className="text-4xl">{dailyTip.icon}</div>
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="bg-primary/10 text-primary px-3 py-1 rounded-full text-sm font-medium">
                  Tip of the Day
                </span>
                <span className={cn("px-3 py-1 rounded-full text-sm capitalize", getCategoryColor(dailyTip.category))}>
                  {dailyTip.category.replace('-', ' ')}
                </span>
              </div>
              <h2 className="text-xl font-semibold text-foreground mb-2">{dailyTip.title}</h2>
              <p className="text-muted-foreground">{dailyTip.description}</p>
            </div>
          </div>
        </div>

        {/* Category Filter */}
        <div className="flex flex-wrap gap-2 mb-8 animate-fade-up" style={{ animationDelay: '200ms' }}>
          {categories.map((category) => (
            <button
              key={category.id}
              onClick={() => setActiveCategory(category.id)}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg border transition-all",
                activeCategory === category.id
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border hover:border-primary/50"
              )}
            >
              <category.icon size={18} />
              <span className="text-sm font-medium">{category.label}</span>
            </button>
          ))}
        </div>

        {/* Tips Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredTips.map((tip, index) => (
            <div
              key={tip.id}
              className="health-card animate-fade-up"
              style={{ animationDelay: `${(index + 3) * 50}ms` }}
            >
              <div className="flex items-start gap-4">
                <div className="text-3xl">{tip.icon}</div>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold text-foreground">{tip.title}</h3>
                    <span className={cn("px-2 py-0.5 rounded-full text-xs capitalize", getCategoryColor(tip.category))}>
                      {tip.category.replace('-', ' ')}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {tip.description}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Quick Health Facts */}
        <div className="mt-12 animate-fade-up" style={{ animationDelay: '400ms' }}>
          <h2 className="text-xl font-semibold text-foreground mb-6 text-center">Quick Health Facts</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="text-center p-6 bg-success/5 rounded-xl border border-success/20">
              <p className="text-3xl font-bold text-success">8</p>
              <p className="text-sm text-muted-foreground mt-1">Glasses of water daily</p>
            </div>
            <div className="text-center p-6 bg-info/5 rounded-xl border border-info/20">
              <p className="text-3xl font-bold text-info">30</p>
              <p className="text-sm text-muted-foreground mt-1">Minutes of exercise</p>
            </div>
            <div className="text-center p-6 bg-primary/5 rounded-xl border border-primary/20">
              <p className="text-3xl font-bold text-primary">7-8</p>
              <p className="text-sm text-muted-foreground mt-1">Hours of sleep</p>
            </div>
            <div className="text-center p-6 bg-warning/5 rounded-xl border border-warning/20">
              <p className="text-3xl font-bold text-warning">5</p>
              <p className="text-sm text-muted-foreground mt-1">Servings of fruits & veggies</p>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default HealthTips;
