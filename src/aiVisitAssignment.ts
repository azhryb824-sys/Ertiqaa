// AI-based visit assignment for technicians
interface Technician {
    id: number;
    name: string;
    availability: boolean;
}

interface VisitRequest {
    id: number;
    requiredSkills: string[];
}

function assignVisits(technicians: Technician[], requests: VisitRequest[]): Map<number, number> {
    const assignments = new Map<number, number>();

    requests.forEach(request => {
        const availableTechnicians = technicians.filter(tech => tech.availability);
        // Simple assignment logic based on availability
        if (availableTechnicians.length > 0) {
            const assignedTech = availableTechnicians[0]; // Assign the first available technician
            assignments.set(request.id, assignedTech.id);
        }
    });

    return assignments;
}

// Example usage
const technicians: Technician[] = [
    { id: 1, name: 'John Doe', availability: true },
    { id: 2, name: 'Jane Smith', availability: false },
];

const requests: VisitRequest[] = [
    { id: 1, requiredSkills: ['Electrical'] },
    { id: 2, requiredSkills: ['Mechanical'] },
];

const assignments = assignVisits(technicians, requests);
console.log(assignments);