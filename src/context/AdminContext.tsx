import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';


interface AdminContextType {
    isAdmin: boolean;
    enableAdmin: () => void;
    disableAdmin: () => void;
}

const AdminContext = createContext<AdminContextType | undefined>(undefined);

export function AdminProvider({ children }: { children: ReactNode }) {
    const [isAdmin, setIsAdmin] = useState(false);

    useEffect(() => {
        const stored = localStorage.getItem('isAdminMode');
        if (stored === 'true') {
            setIsAdmin(true);
        }
    }, []);

    const enableAdmin = () => {
        setIsAdmin(true);
        localStorage.setItem('isAdminMode', 'true');
        // toast.success("Admin mode aktiverat!"); 
    };

    const disableAdmin = () => {
        setIsAdmin(false);
        localStorage.removeItem('isAdminMode');
    };

    return (
        <AdminContext.Provider value={{ isAdmin, enableAdmin, disableAdmin }}>
            {children}
        </AdminContext.Provider>
    );
}

export const useAdmin = () => {
    const context = useContext(AdminContext);
    if (!context) throw new Error("useAdmin must be used within an AdminProvider");
    return context;
};
