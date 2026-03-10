
import { supabase } from './supabase';
import { Company, Employee, AmbulanceState, Resource, EmergencyCase } from '../types';

export const dbService = {
    // Companies
    async getCompanies(): Promise<Company[]> {
        const { data, error } = await supabase.from('companies').select('*');
        if (error) throw error;
        return data as Company[];
    },

    async saveCompany(company: Company) {
        const companyToSave = {
            ...company,
            id: company.id || `COMP-${Math.floor(Math.random() * 9000) + 1000}`
        };
        const { data, error } = await supabase.from('companies').upsert(companyToSave);
        if (error) throw error;
        return data;
    },

    // Profiles
    async getProfile(id: string): Promise<any> {
        const { data, error } = await supabase.from('profiles').select('*').eq('id', id).single();
        if (error) throw error;
        return data;
    },

    async updateProfile(id: string, updates: any) {
        const { data, error } = await supabase.from('profiles').update({
            full_name: updates.name,
            role: updates.role,
            company_id: updates.companyId,
            updated_at: new Date().toISOString()
        }).eq('id', id);
        if (error) throw error;
        return data;
    },

    // Employees
    async getEmployees(): Promise<Employee[]> {
        const { data, error } = await supabase.from('employees').select('*');
        if (error) throw error;
        return data as Employee[];
    },

    async saveEmployee(employee: Employee) {
        const { data, error } = await supabase.from('employees').upsert(employee);
        if (error) throw error;
        return data;
    },

    // Ambulances
    async getAmbulances(): Promise<AmbulanceState[]> {
        const { data, error } = await supabase.from('ambulances').select('*');
        if (error) throw error;
        return (data || []).map(amb => ({
            ...amb,
            currentPos: amb.current_pos as [number, number]
        })) as AmbulanceState[];
    },

    async saveAmbulance(ambulance: AmbulanceState & { imei?: string }) {
        const { data, error } = await supabase.from('ambulances').upsert({
            id: ambulance.id,
            plate: ambulance.plate,
            type: ambulance.type,
            current_pos: ambulance.currentPos,
            phase: ambulance.phase,
            status: ambulance.status,
            company_id: ambulance.companyId,
            imei: ambulance.imei,
            capacity: ambulance.capacity,
            performance: ambulance.performance
        });
        if (error) throw error;
        return data;
    },

    // Resources
    async getResources(): Promise<Resource[]> {
        const { data, error } = await supabase.from('resources').select('*');
        if (error) throw error;
        return data as Resource[];
    },

    async saveResource(resource: Resource) {
        const { data, error } = await supabase.from('resources').upsert(resource);
        if (error) throw error;
        return data;
    },

    // Incidents
    async getIncidents(): Promise<EmergencyCase[]> {
        const { data, error } = await supabase.from('incidents').select('*');
        if (error) throw error;
        return (data || []).map(inc => ({
            ...inc,
            coords: inc.coords as [number, number]
        })) as EmergencyCase[];
    },

    async saveIncident(incident: EmergencyCase) {
        const { data, error } = await supabase.from('incidents').upsert({
            id: incident.id,
            timestamp: incident.timestamp,
            type: incident.type,
            location_name: incident.locationName,
            status: incident.status,
            priority: incident.priority,
            coords: incident.coords,
            company_id: incident.companyId
        });
        if (error) throw error;
        return data;
    },

    // GPS Tracking
    async logGpsTrack(imei: string, coords: [number, number], speed?: number, bearing?: number) {
        const { error } = await supabase.from('gps_tracks').insert({
            imei,
            coords,
            speed,
            bearing
        });
        if (error) throw error;

        // Also update the current position in the ambulances table
        const { error: ambError } = await supabase.from('ambulances')
            .update({ current_pos: coords })
            .eq('imei', imei);

        if (ambError) throw ambError;
    },

    subscribeToGps(callback: (payload: any) => void) {
        return supabase
            .channel('gps_updates')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'gps_tracks' }, callback)
            .subscribe();
    },

    // Communication Logs (Chat)
    async getCommunicationLogs(incidentId: string): Promise<any[]> {
        const { data, error } = await supabase
            .from('communication_logs')
            .select('*')
            .eq('incident_id', incidentId)
            .order('timestamp', { ascending: true });
        if (error) throw error;
        return data.map(log => ({
            id: log.id,
            incidentId: log.incident_id,
            senderId: log.sender_id,
            senderName: log.sender_name,
            senderRole: log.sender_role,
            recipient: log.recipient,
            message: log.message,
            type: log.type,
            isCritical: log.is_critical,
            timestamp: log.timestamp
        }));
    },

    async saveCommunicationLog(log: any) {
        const { data, error } = await supabase.from('communication_logs').insert({
            incident_id: log.incidentId,
            sender_id: log.senderId,
            sender_name: log.senderName,
            sender_role: log.senderRole,
            recipient: log.recipient,
            message: log.message,
            type: log.type,
            is_critical: log.isCritical
        });
        if (error) throw error;
        return data;
    },

    subscribeToChat(incidentId: string, callback: (payload: any) => void) {
        return supabase
            .channel(`chat_${incidentId}`)
            .on('postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'communication_logs', filter: `incident_id=eq.${incidentId}` },
                callback
            )
            .subscribe();
    }
};
