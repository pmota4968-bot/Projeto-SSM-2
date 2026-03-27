
import { supabase } from './supabase';
import { Company, Employee, AmbulanceState, Resource, EmergencyCase, Driver, AdminUser } from '../types';

export const dbService = {
    // Companies
    async getCompanies(): Promise<Company[]> {
        const { data, error } = await supabase
            .from('companies')
            .select('*')
            .eq('is_active', true);
        if (error) throw error;
        return (data || []).map(c => ({
            id: c.id,
            name: c.name,
            logo: c.logo,
            color: c.color,
            type: c.type,
            plan: c.plan,
            contractEnd: c.contract_end,
            totalEmployees: c.total_employees,
            address: c.address,
            phone: c.phone
        })) as Company[];
    },

    async saveCompany(company: Company) {
        const companyToSave = {
            id: company.id || `COMP-${Math.floor(Math.random() * 9000) + 1000}`,
            name: company.name,
            logo: company.logo,
            color: company.color,
            type: company.type,
            plan: company.plan,
            contract_end: company.contractEnd,
            total_employees: company.totalEmployees,
            address: company.address,
            phone: company.phone
        };
        const { data, error } = await supabase.from('companies').upsert(companyToSave);
        if (error) throw error;

        // Log the creation
        await this.logActivity('CREATE', 'company', companyToSave.id, { name: companyToSave.name });

        return data;
    },

    async updateCompany(id: string, updates: Partial<Company>) {
        const companyToUpdate: any = {};
        if (updates.name) companyToUpdate.name = updates.name;
        if (updates.logo) companyToUpdate.logo = updates.logo;
        if (updates.color) companyToUpdate.color = updates.color;
        if (updates.type) companyToUpdate.type = updates.type;
        if (updates.plan) companyToUpdate.plan = updates.plan;
        if (updates.contractEnd) companyToUpdate.contract_end = updates.contractEnd;
        if (updates.totalEmployees !== undefined) companyToUpdate.total_employees = updates.totalEmployees;
        if (updates.address) companyToUpdate.address = updates.address;
        if (updates.phone) companyToUpdate.phone = updates.phone;

        const { data, error } = await supabase
            .from('companies')
            .update(companyToUpdate)
            .eq('id', id);

        if (error) throw error;

        // Log the update
        await this.logActivity('UPDATE', 'company', id, updates);

        return data;
    },

    async deleteCompany(id: string, reason: string) {
        const { data: userData } = await supabase.auth.getUser();
        const userId = userData.user?.id;

        const { data, error } = await supabase
            .from('companies')
            .update({
                is_active: false,
                deletion_reason: reason,
                deleted_at: new Date().toISOString(),
                deleted_by: userId
            })
            .eq('id', id);

        if (error) throw error;

        // Log the deletion
        await this.logActivity('DELETE', 'company', id, { reason });

        return data;
    },

    // Audit Logging
    async logActivity(action: string, entityType: string, entityId: string, details: any) {
        const { data: userData } = await supabase.auth.getUser();
        const userId = userData.user?.id;

        const { error } = await supabase.from('activity_logs').insert({
            user_id: userId,
            action_type: action,
            entity_type: entityType,
            entity_id: entityId,
            details: details
        });

        if (error) console.error("Error logging activity:", error);
    },

    // Profiles
    async getProfile(id: string): Promise<any> {
        const { data, error } = await supabase.from('profiles').select('*').eq('id', id).single();
        if (error) throw error;
        return data;
    },

    async getCompanyManager(companyId: string): Promise<AdminUser | null> {
        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('company_id', companyId)
            .eq('role', 'GESTOR_FROTA_AMB')
            .maybeSingle();
        
        if (error) throw error;
        if (!data) return null;

        return {
            id: data.id,
            name: data.full_name,
            role: data.role,
            avatar: data.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(data.full_name)}&background=0f172a&color=fff`,
            initials: data.full_name.split(' ').map((n: string) => n[0]).join('').toUpperCase().substring(0, 2),
            username: data.username || data.email?.split('@')[0],
            email: data.email,
            phone: data.phone,
            address: data.address,
            dob: data.dob,
            gender: data.gender,
            companyId: data.company_id
        } as AdminUser;
    },

    async updateProfile(id: string, updates: any) {
        const payload: any = {
            updated_at: new Date().toISOString()
        };
        if (updates.name) payload.full_name = updates.name;
        if (updates.role) payload.role = updates.role;
        if (updates.companyId) payload.company_id = updates.companyId;
        if (updates.phone) payload.phone = updates.phone;
        if (updates.email) payload.email = updates.email;

        const { data, error } = await supabase.from('profiles').update(payload).eq('id', id);
        if (error) throw error;
        return data;
    },

    // Employees
    async getEmployees(): Promise<Employee[]> {
        const { data, error } = await supabase.from('employees').select('*');
        if (error) throw error;
        return (data || []).map(e => ({
            id: e.id,
            companyId: e.company_id,
            name: e.name,
            bi: e.bi,
            age: e.age,
            sex: e.sex,
            bloodType: e.blood_type,
            insurer: e.insurer,
            policyNumber: e.policy_number,
            policyValidity: e.policy_validity,
            emergencyContact: e.emergency_contact,
            allergies: e.allergies,
            medications: e.medications,
            medicalHistory: e.medical_history
        })) as Employee[];
    },

    async saveEmployee(employee: Employee) {
        const { data, error } = await supabase.from('employees').upsert({
            id: employee.id,
            company_id: employee.companyId,
            name: employee.name,
            bi: employee.bi,
            age: employee.age,
            sex: employee.sex,
            blood_type: employee.bloodType,
            insurer: employee.insurer,
            policy_number: employee.policyNumber,
            policy_validity: employee.policyValidity,
            emergency_contact: employee.emergencyContact,
            allergies: employee.allergies,
            medications: employee.medications,
            medical_history: employee.medicalHistory
        });
        if (error) throw error;
        return data;
    },

    // Ambulances
    async getAmbulances(): Promise<AmbulanceState[]> {
        const { data, error } = await supabase.from('ambulances').select('*');
        if (error) throw error;
        return (data || []).map(amb => ({
            ...amb,
            companyId: amb.company_id,
            currentPos: amb.current_pos as [number, number]
        })) as AmbulanceState[];
    },

    async saveAmbulance(ambulance: AmbulanceState & { imei?: string }) {
        const payload: any = {
            plate: ambulance.plate,
            type: ambulance.type,
            current_pos: ambulance.currentPos,
            phase: ambulance.phase,
            status: ambulance.status,
            company_id: ambulance.companyId,
            imei: ambulance.imei,
            capacity: ambulance.capacity,
            performance: ambulance.performance
        };
        
        if (ambulance.id) {
            payload.id = ambulance.id;
        }

        const { data, error } = await supabase.from('ambulances').upsert(payload);
        if (error) throw error;
        return data;
    },

    // Drivers
    async getDrivers(companyId?: string): Promise<Driver[]> {
        let query = supabase.from('drivers').select('*');
        if (companyId) {
            query = query.eq('company_id', companyId);
        }
        const { data, error } = await query;
        if (error) throw error;
        return (data || []).map(d => ({
            id: d.id,
            companyId: d.company_id,
            name: d.name,
            licenseNumber: d.license_number,
            phone: d.phone,
            email: d.email,
            imei: d.imei,
            authUserId: d.auth_user_id,
            status: d.status as any,
            createdAt: d.created_at
        }));
    },

    async getDriverByAuthId(authUserId: string): Promise<Driver | null> {
        const { data, error } = await supabase
            .from('drivers')
            .select('*')
            .eq('auth_user_id', authUserId)
            .maybeSingle();

        if (error) throw error;
        if (!data) return null;

        return {
            id: data.id,
            companyId: data.company_id,
            name: data.name,
            licenseNumber: data.license_number,
            phone: data.phone,
            email: data.email,
            imei: data.imei,
            authUserId: data.auth_user_id,
            status: data.status as any,
            createdAt: data.created_at
        };
    },

    async saveDriver(driver: Partial<Driver>) {
        const payload: any = {
            company_id: driver.companyId,
            name: driver.name,
            license_number: driver.licenseNumber,
            phone: driver.phone,
            email: driver.email,
            imei: driver.imei,
            auth_user_id: driver.authUserId,
            status: driver.status
        };

        if (driver.id) {
            payload.id = driver.id;
        }

        const { data, error } = await supabase.from('drivers').upsert(payload);
        if (error) throw error;
        return data;
    },

    // Resources
    async getResources(): Promise<Resource[]> {
        const { data, error } = await supabase.from('resources').select('*');
        if (error) throw error;
        return (data || []).map(r => ({
            ...r,
            companyId: r.company_id
        })) as Resource[];
    },

    async saveResource(resource: Resource) {
        const { data, error } = await supabase.from('resources').upsert({
            ...resource,
            company_id: resource.companyId
        });
        if (error) throw error;
        return data;
    },

    // Incidents
    async getIncidents(): Promise<EmergencyCase[]> {
        const { data, error } = await supabase.from('incidents').select('*');
        if (error) throw error;
        return (data || []).map(inc => ({
            ...inc,
            companyId: inc.company_id,
            locationName: inc.location_name,
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
