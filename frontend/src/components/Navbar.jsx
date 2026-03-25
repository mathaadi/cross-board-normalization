import { NavLink } from 'react-router-dom';
import { useState } from 'react';

const links = [
    {
        to: '/', label: 'Dashboard', icon: (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></svg>
        )
    },
    {
        to: '/calculator', label: 'Calculator', icon: (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="2" width="16" height="20" rx="2" /><line x1="8" y1="6" x2="16" y2="6" /><line x1="8" y1="10" x2="10" y2="10" /><line x1="14" y1="10" x2="16" y2="10" /><line x1="8" y1="14" x2="10" y2="14" /><line x1="14" y1="14" x2="16" y2="14" /><line x1="8" y1="18" x2="16" y2="18" /></svg>
        )
    },
    {
        to: '/statistics', label: 'Statistics', icon: (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /></svg>
        )
    },
    {
        to: '/admin', label: 'Admin', icon: (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>
        )
    },
    {
        to: '/academic-record', label: 'Academic', icon: (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" /></svg>
        )
    },
    {
        to: '/students', label: 'Students', icon: (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
        )
    },
    {
        to: '/academic-ocr', label: 'OCR', icon: (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" /></svg>
        )
    },
];

export default function Navbar() {
    const [mobileOpen, setMobileOpen] = useState(false);

    return (
        <nav className="fixed top-0 left-0 right-0 z-50" style={{
            background: 'rgba(5, 10, 24, 0.75)',
            backdropFilter: 'blur(20px) saturate(1.5)',
            borderBottom: '1px solid rgba(255,255,255,0.05)',
        }}>
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-14">
                {/* Logo */}
                <NavLink to="/" className="flex items-center gap-2.5 group">
                    <div className="relative">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-extrabold text-xs"
                            style={{ background: 'linear-gradient(135deg, #6366f1, #06b6d4)' }}>
                            CB
                        </div>
                        <div className="absolute inset-0 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                            style={{ background: 'linear-gradient(135deg, #6366f1, #06b6d4)', filter: 'blur(12px)' }} />
                    </div>
                    <div className="hidden sm:block">
                        <span className="text-sm font-bold text-white tracking-tight">CrossBoard</span>
                        <span className="text-[10px] font-medium ml-1.5 px-1.5 py-0.5 rounded-full"
                            style={{ background: 'rgba(99,102,241,0.15)', color: '#818cf8' }}>v1.0</span>
                    </div>
                </NavLink>

                {/* Desktop Links */}
                <div className="hidden md:flex items-center gap-0.5">
                    {links.map((l) => (
                        <NavLink
                            key={l.to}
                            to={l.to}
                            className={({ isActive }) =>
                                `flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 ${isActive
                                    ? 'text-white'
                                    : 'text-[#5a6a96] hover:text-[#8b9cc7]'
                                }`
                            }
                            style={({ isActive }) => isActive ? {
                                background: 'rgba(99,102,241,0.12)',
                                boxShadow: '0 0 12px rgba(99,102,241,0.1)',
                            } : {}}
                        >
                            {l.icon}
                            {l.label}
                        </NavLink>
                    ))}
                </div>

                {/* Mobile toggle */}
                <button onClick={() => setMobileOpen(!mobileOpen)} className="md:hidden text-[#8b9cc7] p-1">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                        {mobileOpen ? <><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></>
                            : <><line x1="3" y1="8" x2="21" y2="8" /><line x1="3" y1="16" x2="21" y2="16" /></>}
                    </svg>
                </button>
            </div>

            {/* Mobile Menu */}
            {mobileOpen && (
                <div className="md:hidden px-4 pb-3 border-t border-white/5" style={{ background: 'rgba(5,10,24,0.95)' }}>
                    {links.map(l => (
                        <NavLink key={l.to} to={l.to} onClick={() => setMobileOpen(false)}
                            className={({ isActive }) => `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium ${isActive ? 'text-white bg-indigo-500/10' : 'text-[#5a6a96]'}`}>
                            {l.icon}{l.label}
                        </NavLink>
                    ))}
                </div>
            )}
        </nav>
    );
}
