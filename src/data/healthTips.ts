import { HealthTip } from '@/types';

export const healthTips: HealthTip[] = [
  // Diet Tips
  {
    id: '1',
    category: 'diet',
    title: 'Eat the Rainbow',
    description: 'Include fruits and vegetables of different colors in your diet. Each color provides unique nutrients and antioxidants essential for good health.',
    icon: '🥗',
  },
  {
    id: '2',
    category: 'diet',
    title: 'Stay Hydrated',
    description: 'Drink at least 8 glasses of water daily. Proper hydration helps maintain body temperature, aids digestion, and keeps skin healthy.',
    icon: '💧',
  },
  {
    id: '3',
    category: 'diet',
    title: 'Limit Processed Foods',
    description: 'Reduce intake of processed and packaged foods. Choose whole, natural foods for better nutrition and fewer harmful additives.',
    icon: '🚫',
  },
  {
    id: '4',
    category: 'diet',
    title: 'Mindful Eating',
    description: 'Eat slowly and without distractions. This helps with better digestion, portion control, and enjoyment of food.',
    icon: '🧘',
  },

  // Exercise Tips
  {
    id: '5',
    category: 'exercise',
    title: '30 Minutes Daily',
    description: 'Aim for at least 30 minutes of moderate exercise daily. Walking, swimming, or cycling can significantly improve cardiovascular health.',
    icon: '🏃',
  },
  {
    id: '6',
    category: 'exercise',
    title: 'Stretch Every Morning',
    description: 'Start your day with gentle stretches. It improves flexibility, increases blood flow, and helps prevent injuries throughout the day.',
    icon: '🤸',
  },
  {
    id: '7',
    category: 'exercise',
    title: 'Take the Stairs',
    description: 'Choose stairs over elevators when possible. It\'s an easy way to add physical activity to your daily routine.',
    icon: '🪜',
  },
  {
    id: '8',
    category: 'exercise',
    title: 'Strength Training',
    description: 'Include strength training 2-3 times per week. It builds muscle, boosts metabolism, and improves bone density.',
    icon: '💪',
  },

  // Mental Health Tips
  {
    id: '9',
    category: 'mental-health',
    title: 'Practice Gratitude',
    description: 'Write down three things you\'re grateful for each day. This simple practice can significantly improve mental well-being.',
    icon: '🙏',
  },
  {
    id: '10',
    category: 'mental-health',
    title: 'Digital Detox',
    description: 'Take regular breaks from screens and social media. Unplugging helps reduce stress and improves focus.',
    icon: '📵',
  },
  {
    id: '11',
    category: 'mental-health',
    title: 'Deep Breathing',
    description: 'Practice deep breathing exercises for 5 minutes daily. It activates the parasympathetic nervous system and reduces anxiety.',
    icon: '🌬️',
  },
  {
    id: '12',
    category: 'mental-health',
    title: 'Connect with Others',
    description: 'Maintain meaningful relationships. Social connections are vital for emotional health and longevity.',
    icon: '🤝',
  },

  // Sleep Tips
  {
    id: '13',
    category: 'sleep',
    title: 'Consistent Sleep Schedule',
    description: 'Go to bed and wake up at the same time daily, even on weekends. This regulates your circadian rhythm.',
    icon: '⏰',
  },
  {
    id: '14',
    category: 'sleep',
    title: 'Dark & Cool Room',
    description: 'Keep your bedroom dark and cool (65-68°F). This environment promotes deeper, more restorative sleep.',
    icon: '🌙',
  },
  {
    id: '15',
    category: 'sleep',
    title: 'No Screens Before Bed',
    description: 'Avoid screens for 1 hour before sleep. Blue light disrupts melatonin production and makes it harder to fall asleep.',
    icon: '📱',
  },
  {
    id: '16',
    category: 'sleep',
    title: 'Limit Caffeine',
    description: 'Avoid caffeine after 2 PM. It stays in your system for hours and can significantly impact sleep quality.',
    icon: '☕',
  },
];

export const getRandomTips = (count: number = 4): HealthTip[] => {
  const shuffled = [...healthTips].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
};

export const getTipsByCategory = (category: HealthTip['category']): HealthTip[] => {
  return healthTips.filter(tip => tip.category === category);
};

export const getDailyTip = (): HealthTip => {
  const today = new Date();
  const dayOfYear = Math.floor((today.getTime() - new Date(today.getFullYear(), 0, 0).getTime()) / (1000 * 60 * 60 * 24));
  return healthTips[dayOfYear % healthTips.length];
};
