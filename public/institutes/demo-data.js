export const drives = [
  { id: 101, company: 'Astra Systems', role: 'Software Engineer', date: '2026-03-12', min_cgpa: 7.0, allowed_departments: ['CSE', 'IT', 'ECE'], status: 'upcoming' },
  { id: 102, company: 'BlueOrbit Labs', role: 'Data Analyst', date: '2026-03-18', min_cgpa: 6.8, allowed_departments: ['CSE', 'IT', 'EEE', 'ME'], status: 'upcoming' },
  { id: 103, company: 'CoreGrid Energy', role: 'Graduate Engineer Trainee', date: '2026-03-25', min_cgpa: 6.5, allowed_departments: ['EEE', 'ECE', 'ME', 'CE'], status: 'upcoming' },
  { id: 104, company: 'Delta Fintech', role: 'Risk Operations Associate', date: '2026-04-02', min_cgpa: 7.2, allowed_departments: ['CSE', 'IT', 'BBA', 'MBA'], status: 'upcoming' },
  { id: 105, company: 'Evera Motors', role: 'Design Engineer', date: '2026-01-20', min_cgpa: 6.2, allowed_departments: ['ME', 'EE', 'ECE'], status: 'completed' },
  { id: 106, company: 'Futura Retail', role: 'Management Trainee', date: '2026-01-28', min_cgpa: 6.0, allowed_departments: ['BBA', 'MBA', 'CSE', 'IT'], status: 'completed' },
  { id: 107, company: 'GreenPixel Media', role: 'Frontend Developer', date: '2026-02-06', min_cgpa: 6.9, allowed_departments: ['CSE', 'IT', 'ECE'], status: 'completed' },
  { id: 108, company: 'Helios Biotech', role: 'Quality Associate', date: '2026-04-10', min_cgpa: 7.1, allowed_departments: ['BT', 'CHE', 'CSE'], status: 'upcoming' },
];

const firstNames = ['Aarav', 'Isha', 'Rohit', 'Nisha', 'Karan', 'Meera', 'Vivek', 'Tanvi', 'Rahul', 'Sneha', 'Arjun', 'Pooja'];
const lastNames = ['Sharma', 'Patel', 'Reddy', 'Nair', 'Singh', 'Joshi', 'Iyer', 'Das', 'Kapoor', 'Jain'];
const departments = ['CSE', 'IT', 'ECE', 'EEE', 'ME', 'CE', 'BBA', 'MBA', 'BT', 'CHE'];
const riskCycle = ['low', 'medium', 'high', 'low', 'medium'];

export const students = Array.from({ length: 60 }, (_, index) => {
  const id = index + 1;
  const firstName = firstNames[index % firstNames.length];
  const lastName = lastNames[(index * 3) % lastNames.length];
  const dept = departments[index % departments.length];
  const cgpa = Number((6.1 + ((index * 7) % 27) / 10).toFixed(2));
  const risk_level = riskCycle[index % riskCycle.length];

  return {
    id,
    name: `${firstName} ${lastName}`,
    email: `student${String(id).padStart(2, '0')}@campus.edu`,
    dept,
    cgpa,
    batch_year: id % 6 === 0 ? 2025 : 2026,
    risk_level,
  };
});

const stages = ['applied', 'interview', 'offer', 'rejected'];
export const applications = drives.flatMap((drive, driveIndex) => {
  const start = driveIndex * 6;
  const count = 12;
  return Array.from({ length: count }, (_, itemIndex) => {
    const student = students[(start + itemIndex * 2) % students.length];
    return {
      student_id: student.id,
      drive_id: drive.id,
      stage: stages[(driveIndex + itemIndex) % stages.length],
    };
  });
});

export const counselling_sessions = Array.from({ length: 24 }, (_, index) => {
  const id = index + 1;
  const student = students[(index * 2) % students.length];
  const month = String((index % 4) + 2).padStart(2, '0');
  const day = String((index % 22) + 1).padStart(2, '0');
  const hour = String(10 + (index % 6)).padStart(2, '0');
  const statuses = ['scheduled', 'completed', 'rescheduled', 'cancelled'];
  return {
    id,
    student_id: student.id,
    scheduled_at: `2026-${month}-${day}T${hour}:00:00`,
    status: statuses[index % statuses.length],
  };
});

export const counselling_notes = Array.from({ length: 20 }, (_, index) => {
  const id = index + 1;
  const student = students[(index * 3) % students.length];
  const notes = [
    'Discussed interview confidence and resume tailoring for product roles.',
    'Aligned on weekly aptitude plan and mock-test milestones.',
    'Suggested peer mock interviews and communication drills.',
    'Reviewed low CGPA risk strategy with shortlist of eligible drives.',
    'Shared action plan for improving attendance and placement readiness.',
  ];
  return {
    id,
    student_id: student.id,
    note: notes[index % notes.length],
    created_at: `2026-0${(index % 4) + 1}-${String((index % 25) + 1).padStart(2, '0')}T11:30:00`,
  };
});
