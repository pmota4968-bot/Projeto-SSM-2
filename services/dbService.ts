
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
        if (updates.email) payload.email = updates.email;
        if (updates.avatar_url) payload.avatar_url = updates.avatar_url;
        
        // Novos campos para persistência total
        if (updates.username) payload.username = updates.username;
        if (updates.idDocument) payload.id_document = updates.idDocument;
        if (updates.dob) payload.dob = updates.dob;
        if (updates.gender) payload.gender = updates.gender;
        if (updates.address) payload.address = updates.address;
        if (updates.preferences) payload.preferences = updates.preferences;

        // Se houver avatar, usamos o RPC para bypassar RLS se necessário
        if (updates.avatar) {
            const { error: rpcError } = await supabase.rpc('update_own_avatar', { avatar_text: updates.avatar });
            if (rpcError) {
                console.warn("RPC update_own_avatar failed, falling back to direct update:", rpcError);
            }
            payload.avatar_url = updates.avatar;
        }

        console.log(`Upserting profile for ${id} with payload:`, payload);
        
        // Implement retry logic for Foreign Key constraint violations (PROFILES_ID_FKEY)
        // This handles cases where auth.users might not be immediately consistent
        let retries = 3;
        let lastError = null;

        while (retries > 0) {
            const { data, error } = await supabase
                .from('profiles')
                .upsert({ id, ...payload }, { onConflict: 'id' })
                .select();
                
            if (!error) {
                console.log("Profile upsert success");
                return data;
            }

            // Check if it's a Foreign Key violation (23503)
            if (error.code === '23503') {
                console.warn(`Foreign Key violation ao criar perfil. Tentando novamente... (${retries - 1} restantes)`);
                lastError = error;
                retries--;
                await new Promise(resolve => setTimeout(resolve, 1500)); // Wait 1.5s
                continue;
            }

            console.error("Error upserting profile in DB:", error);
            throw error;
        }

        throw lastError;
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
            medicalHistory: e.medical_history,
            avatar: e.avatar_url
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
            medical_history: employee.medicalHistory,
            avatar_url: employee.avatar
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
            currentAmbulanceId: d.current_ambulance_id,
            avatar: d.avatar_url,
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
            currentAmbulanceId: data.current_ambulance_id,
            avatar: data.avatar_url,
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
            status: driver.status,
            current_ambulance_id: driver.currentAmbulanceId,
            avatar_url: driver.avatar
        };

        if (driver.id) payload.id = driver.id;

        // Implement retry logic for Foreign Key constraint violations
        // This handles cases where auth.users might not be immediately consistent
        // or background triggers (like profile creation) haven't finished yet.
        let retries = 3;
        let lastError = null;

        while (retries > 0) {
            const { data, error } = await supabase.from('drivers').upsert(payload);
            if (!error) return data;

            // Check if it's a Foreign Key violation (23503 is the PostgreSQL code)
            if (error.code === '23503') {
                console.warn(`Tentativa de salvar motorista falhou (FK violation). Tentativas restantes: ${retries - 1}`);
                lastError = error;
                retries--;
                // Wait 1 second before retrying
                await new Promise(resolve => setTimeout(resolve, 1000));
                continue;
            }

            throw error; // Other errors should be thrown immediately
        }

        throw lastError;
    },

    async updateDriverByAuthId(authUserId: string, updates: any) {
        const payload: any = {};
        if (updates.name) payload.name = updates.name;
        if (updates.phone) payload.phone = updates.phone;
        if (updates.avatar_url !== undefined) payload.avatar_url = updates.avatar_url;
        if (updates.status) payload.status = updates.status;

        const { data, error } = await supabase
            .from('drivers')
            .update(payload)
            .eq('auth_user_id', authUserId);
            
        if (error) console.error("Error updating driver record:", error);
        return data;
    },

    async deleteDriver(driverId: string) {
        // Usa a stored procedure para contornar as restrições de RLS no auth.users
        const { error } = await supabase.rpc('delete_driver_user', { driver_id: driverId });
        if (error) {
            console.error("RPC delete_driver_user failed:", error);
            // Fallback direto apenas para a tabela drivers (não apaga o Auth User se falhar no RPC)
            const { error: fallbackError } = await supabase.from('drivers').delete().eq('id', driverId);
            if (fallbackError) throw fallbackError;
        }
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
        return (data || []).map(inc => {
            const ambState = inc.ambulance_state;
            return {
                ...inc,
                companyId: inc.company_id,
                locationName: inc.location_name,
                patientName: inc.patient_name,
                ambulanceState: ambState,
                ambulanceId: inc.ambulance_id || (ambState?.id), // Restore ID from JSONB if column is missing
                coords: inc.coords as [number, number]
            };
        }) as EmergencyCase[];
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

    async dispatchAmbulance(incidentId: string, ambulanceState: any) {
        // Envia o estado completo da ambulância como um JSONB para a coluna ambulance_state
        const { data, error } = await supabase.from('incidents')
            .update({ ambulance_state: ambulanceState })
            .eq('id', incidentId);
        
        if (error) {
            console.error("Error dispatching ambulance:", error);
            throw error;
        }
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
