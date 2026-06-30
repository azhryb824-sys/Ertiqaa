export function calculateMaintenanceSchedule(lastMaintenanceDate: Date, intervalDays: number): Date {
    const nextMaintenanceDate = new Date(lastMaintenanceDate);
    nextMaintenanceDate.setDate(lastMaintenanceDate.getDate() + intervalDays);
    return nextMaintenanceDate;
}