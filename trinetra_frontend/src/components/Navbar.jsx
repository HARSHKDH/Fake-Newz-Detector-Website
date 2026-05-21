import { Link, useNavigate, useLocation } from 'react-router-dom'
import { Shield, Newspaper, Scan, User, LogOut, Menu, X, ChevronDown, BarChart2 } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useState } from 'react'

export default function Navbar() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)

  const isActive = (path) => location.pathname === path

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const navItems = [
    { path: '/', label: 'News Feed', icon: Newspaper },
    { path: '/analyze', label: 'Trinetra AI', icon: Scan },
    { path: '/analytics', label: 'Analytics', icon: BarChart2 },
  ]

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-navy-900 border-b border-navy-700 shadow-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-3 group">
            <div className="relative">
              <div className="w-9 h-9 bg-trinetra-blue rounded-xl flex items-center justify-center group-hover:shadow-glow transition-shadow duration-300">
                <Shield className="w-5 h-5 text-white" strokeWidth={2.5} />
              </div>
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-trinetra-green rounded-full border-2 border-navy-900 animate-pulse-slow" />
            </div>
            <div className="hidden sm:block">
              <span className="text-white font-bold text-lg tracking-tight">Trinetra</span>
              <div className="text-navy-500 text-xs font-medium -mt-0.5">Verify · Trust · Know</div>
            </div>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-1">
            {navItems.map(({ path, label, icon: Icon }) => (
              <Link
                key={path}
                to={path}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
                  isActive(path)
                    ? 'bg-trinetra-blue text-white shadow-glow'
                    : 'text-slate-300 hover:text-white hover:bg-navy-700'
                }`}
              >
                <Icon className="w-4 h-4" />
                {label}
              </Link>
            ))}
          </div>

          {/* User Menu */}
          <div className="hidden md:flex items-center gap-3">
            {user ? (
              <div className="relative">
                <button
                  onClick={() => setProfileOpen(!profileOpen)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-xl hover:bg-navy-700 transition-all group"
                  id="user-menu-btn"
                >
                  <div className="w-8 h-8 rounded-full bg-trinetra-blue flex items-center justify-center overflow-hidden">
                    {user.avatar_url
                      ? <img src={user.avatar_url} alt={user.full_name} className="w-full h-full object-cover" />
                      : <span className="text-white text-sm font-semibold">{(user.full_name || user.email)[0].toUpperCase()}</span>
                    }
                  </div>
                  <span className="text-slate-300 text-sm font-medium max-w-[120px] truncate">
                    {user.full_name || user.email.split('@')[0]}
                  </span>
                  <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${profileOpen ? 'rotate-180' : ''}`} />
                </button>

                {profileOpen && (
                  <div className="absolute right-0 mt-2 w-52 bg-white rounded-2xl shadow-card-hover border border-slate-100 overflow-hidden z-50 animate-slide-up">
                    <div className="px-4 py-3 border-b border-slate-100">
                      <p className="text-sm font-semibold text-slate-800 truncate">{user.full_name || 'User'}</p>
                      <p className="text-xs text-slate-500 truncate">{user.email}</p>
                    </div>
                    <div className="py-1">
                      <Link
                        to="/profile"
                        onClick={() => setProfileOpen(false)}
                        className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-600 hover:bg-slate-50 hover:text-trinetra-blue transition-colors"
                        id="profile-link"
                      >
                        <User className="w-4 h-4" /> My Profile
                      </Link>
                      <button
                        onClick={handleLogout}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 transition-colors"
                        id="logout-btn"
                      >
                        <LogOut className="w-4 h-4" /> Sign Out
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <Link to="/login" className="btn-primary">Sign In</Link>
            )}
          </div>

          {/* Mobile menu toggle */}
          <button
            className="md:hidden p-2 rounded-xl text-slate-300 hover:bg-navy-700"
            onClick={() => setMenuOpen(!menuOpen)}
            id="mobile-menu-btn"
          >
            {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="md:hidden bg-navy-800 border-t border-navy-700 px-4 py-3 space-y-1">
          {navItems.map(({ path, label, icon: Icon }) => (
            <Link
              key={path}
              to={path}
              onClick={() => setMenuOpen(false)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium ${
                isActive(path) ? 'bg-trinetra-blue text-white' : 'text-slate-300 hover:bg-navy-700'
              }`}
            >
              <Icon className="w-4 h-4" /> {label}
            </Link>
          ))}
          {user && (
            <>
              <Link to="/profile" onClick={() => setMenuOpen(false)} className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm text-slate-300 hover:bg-navy-700">
                <User className="w-4 h-4" /> Profile
              </Link>
              <button onClick={handleLogout} className="w-full flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm text-red-400 hover:bg-navy-700">
                <LogOut className="w-4 h-4" /> Sign Out
              </button>
            </>
          )}
        </div>
      )}
    </nav>
  )
}
