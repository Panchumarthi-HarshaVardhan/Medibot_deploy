export const symptoms = [
  'Headache',
  'Fever',
  'Cough',
  'Sore Throat',
  'Fatigue',
  'Body Aches',
  'Nausea',
  'Vomiting',
  'Diarrhea',
  'Stomach Pain',
  'Chest Pain',
  'Shortness of Breath',
  'Dizziness',
  'Runny Nose',
  'Congestion',
  'Skin Rash',
  'Joint Pain',
  'Back Pain',
  'Loss of Appetite',
  'Chills',
];

export const specializations = [
  'General Physician',
  'Cardiologist',
  'Dermatologist',
  'Orthopedic',
  'Pediatrician',
  'Gynecologist',
  'Neurologist',
  'Psychiatrist',
  'ENT Specialist',
  'Ophthalmologist',
  'Gastroenterologist',
  'Pulmonologist',
];

export const doctors: Record<string, string[]> = {
  'General Physician': ['Dr. Sarah Johnson', 'Dr. Michael Chen', 'Dr. Emily Davis'],
  'Cardiologist': ['Dr. Robert Wilson', 'Dr. Amanda Lee', 'Dr. James Brown'],
  'Dermatologist': ['Dr. Jessica Martinez', 'Dr. David Kim', 'Dr. Lisa Thompson'],
  'Orthopedic': ['Dr. Christopher Garcia', 'Dr. Jennifer Anderson', 'Dr. Matthew White'],
  'Pediatrician': ['Dr. Ashley Taylor', 'Dr. Daniel Harris', 'Dr. Nicole Clark'],
  'Gynecologist': ['Dr. Stephanie Robinson', 'Dr. Michelle Lewis', 'Dr. Karen Walker'],
  'Neurologist': ['Dr. Andrew Hall', 'Dr. Rebecca Young', 'Dr. Brian King'],
  'Psychiatrist': ['Dr. Laura Scott', 'Dr. Kevin Wright', 'Dr. Amy Green'],
  'ENT Specialist': ['Dr. Thomas Baker', 'Dr. Sandra Hill', 'Dr. Ryan Adams'],
  'Ophthalmologist': ['Dr. Catherine Nelson', 'Dr. Patrick Turner', 'Dr. Diana Evans'],
  'Gastroenterologist': ['Dr. William Phillips', 'Dr. Susan Campbell', 'Dr. Joseph Mitchell'],
  'Pulmonologist': ['Dr. Elizabeth Roberts', 'Dr. Mark Turner', 'Dr. Nancy Cooper'],
};

export const timeSlots = [
  '09:00 AM',
  '09:30 AM',
  '10:00 AM',
  '10:30 AM',
  '11:00 AM',
  '11:30 AM',
  '02:00 PM',
  '02:30 PM',
  '03:00 PM',
  '03:30 PM',
  '04:00 PM',
  '04:30 PM',
];

interface SymptomAnalysis {
  condition: string;
  advice: string;
  severity: 'mild' | 'moderate' | 'severe';
  recommendation: string;
}

export const analyzeSymptoms = (selectedSymptoms: string[], age: number, gender: string): SymptomAnalysis => {
  const lowerSymptoms = selectedSymptoms.map(s => s.toLowerCase());
  
  // Check for severe combinations first
  if (lowerSymptoms.includes('chest pain') || lowerSymptoms.includes('shortness of breath')) {
    return {
      condition: 'Possible Cardiac/Respiratory Issue',
      advice: 'These symptoms require immediate medical attention. Please seek emergency care or call emergency services.',
      severity: 'severe',
      recommendation: 'Visit emergency room immediately or call 911',
    };
  }

  // Common cold/flu symptoms
  if (
    (lowerSymptoms.includes('fever') || lowerSymptoms.includes('cough')) &&
    (lowerSymptoms.includes('sore throat') || lowerSymptoms.includes('runny nose') || lowerSymptoms.includes('congestion'))
  ) {
    return {
      condition: 'Common Cold or Flu',
      advice: 'Rest well, stay hydrated, and take over-the-counter cold medications. Use honey and warm fluids for sore throat. Monitor temperature regularly.',
      severity: lowerSymptoms.includes('fever') ? 'moderate' : 'mild',
      recommendation: lowerSymptoms.includes('fever') 
        ? 'Rest at home, take OTC medication. See a doctor if symptoms persist beyond 5-7 days.'
        : 'Rest at home with plenty of fluids',
    };
  }

  // Gastrointestinal issues
  if (
    lowerSymptoms.includes('nausea') || 
    lowerSymptoms.includes('vomiting') || 
    lowerSymptoms.includes('diarrhea') ||
    lowerSymptoms.includes('stomach pain')
  ) {
    const isMultiple = lowerSymptoms.filter(s => 
      ['nausea', 'vomiting', 'diarrhea', 'stomach pain'].includes(s)
    ).length > 1;
    
    return {
      condition: 'Gastrointestinal Distress',
      advice: 'Stick to bland foods (BRAT diet), stay hydrated with small sips, avoid dairy and fatty foods. Rest and let your digestive system recover.',
      severity: isMultiple ? 'moderate' : 'mild',
      recommendation: isMultiple 
        ? 'Book an appointment if symptoms persist beyond 48 hours'
        : 'Rest at home, follow BRAT diet',
    };
  }

  // Headache with other symptoms
  if (lowerSymptoms.includes('headache')) {
    if (lowerSymptoms.includes('dizziness') || lowerSymptoms.includes('fever')) {
      return {
        condition: 'Headache with Concerning Symptoms',
        advice: 'Rest in a dark, quiet room. Stay hydrated and take pain relievers if appropriate. Monitor for worsening symptoms.',
        severity: 'moderate',
        recommendation: 'Schedule a doctor appointment within 24-48 hours',
      };
    }
    return {
      condition: 'Tension Headache',
      advice: 'Rest in a quiet room, reduce screen time, stay hydrated, and consider over-the-counter pain relief.',
      severity: 'mild',
      recommendation: 'Rest at home with OTC pain medication',
    };
  }

  // Musculoskeletal issues
  if (lowerSymptoms.includes('joint pain') || lowerSymptoms.includes('back pain') || lowerSymptoms.includes('body aches')) {
    return {
      condition: 'Musculoskeletal Discomfort',
      advice: 'Apply heat or cold packs, gentle stretching, and rest the affected area. Over-the-counter anti-inflammatory medication may help.',
      severity: 'mild',
      recommendation: 'Rest and self-care, see a doctor if pain persists beyond a week',
    };
  }

  // Fatigue
  if (lowerSymptoms.includes('fatigue') || lowerSymptoms.includes('loss of appetite')) {
    return {
      condition: 'General Fatigue',
      advice: 'Ensure adequate sleep (7-8 hours), eat nutritious meals, stay hydrated, and reduce stress. Consider vitamin supplements.',
      severity: 'mild',
      recommendation: 'Monitor symptoms, book appointment if persisting beyond 2 weeks',
    };
  }

  // Default response for single or unclear symptoms
  return {
    condition: 'General Health Concern',
    advice: 'Monitor your symptoms closely. Maintain good hydration, rest, and a healthy diet. Keep track of any changes or new symptoms.',
    severity: 'mild',
    recommendation: 'Self-monitor for 24-48 hours. Book an appointment if symptoms worsen.',
  };
};
