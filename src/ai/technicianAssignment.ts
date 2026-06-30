// This module handles the AI-based assignment of visits to technicians

interface Technician {
    id: string;
    name: string;
    skills: string[];
    availability: boolean;
    location: string;
}

interface Visit {
    id: string;
    requiredSkills: string[];
    location: string;
}

function assignTechnician(visits: Visit[], technicians: Technician[]): Map<string, string> {
    const assignments = new Map<string, string>();

    visits.forEach(visit => {
        const suitableTechnicians = technicians.filter(technician => 
            technician.availability && 
            visit.requiredSkills.every(skill => technician.skills.includes(skill))
        );

        if (suitableTechnicians.length > 0) {
            const assignedTechnician = suitableTechnicians[0]; // Simple assignment logic
            assignments.set(visit.id, assignedTechnician.id);
        }
    });

    return assignments;
}

// Example usage
const technicians: Technician[] = [
    { id: '1', name: 'Alice', skills: ['Electrical', 'Mechanical'], availability: true, location: 'City A' },
    { id: '2', name: 'Bob', skills: ['Electrical'], availability: true, location: 'City B' }
];

const visits: Visit[] = [
    { id: 'v1', requiredSkills: ['Electrical'], location: 'City A' },
    { id: 'v2', requiredSkills: ['Mechanical'], location: 'City B' }
];

const assignments = assignTechnician(visits, technicians);
console.log(assignments);