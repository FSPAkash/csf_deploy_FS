import { LogOut, Settings, GraduationCap, FlaskConical, Zap } from 'lucide-react';

import { Button, Badge } from '../common';

function Header({ user, isAdmin, isBeta, onLogout, onDevMode, onBetaDashboard, onBeta2Dashboard, onStartTutorial }) {
  return (
    <header className="sticky top-0 z-[var(--z-sticky)] border-b border-surface-200/50 bg-white/70 backdrop-blur-md">
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-3" data-tutorial="header">
            <span className="text-sm font-extrabold text-daikin-dark tracking-tight">SCENARIO SIMULATOR</span>
          </div>

          {/* User Info and Actions */}
          <div className="flex items-center gap-4">
            {/* User Badge */}
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-daikin-blue to-daikin-light flex items-center justify-center text-white text-sm font-semibold">
                {user?.username?.[0]?.toUpperCase() || 'U'}
              </div>
              <div className="hidden sm:flex items-center gap-1">
                {isAdmin && (
                  <Badge variant="primary" size="sm">Admin</Badge>
                )}
                {isBeta && (
                  <Badge variant="secondary" size="sm" className="bg-red-100 text-red-700">Beta</Badge>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
              <Button
                variant="primary"
                size="sm"
                onClick={onStartTutorial}
                leftIcon={<GraduationCap className="h-4 w-4" />}
              >
                <span className="hidden sm:inline">Learning Mode</span>
                <span className="sm:hidden">Learn</span>
              </Button>

              {isBeta && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={onBetaDashboard}

                  className="bg-red-100 text-red-700 hover:bg-red-200"
                >
                  <span className="hidden sm:inline">Concept 1.2</span>
                  <span className="sm:hidden">B1</span>
                </Button>
              )}

              {isBeta && onBeta2Dashboard && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={onBeta2Dashboard}
                  className="bg-slate-800 text-red-700 hover:bg-slate-700 border border-cyan-500/30"
                >
                  <span className="hidden sm:inline">Concept 1.3</span>
                  <span className="sm:hidden">B2</span>
                </Button>
              )}

              {isAdmin && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={onDevMode}
                  leftIcon={<Settings className="h-4 w-4" />}
                >
                  <span className="hidden sm:inline">Dev Mode</span>
                  <span className="sm:hidden">Dev</span>
                </Button>
              )}

              <Button
                variant="ghost"
                size="sm"
                onClick={onLogout}
                leftIcon={<LogOut className="h-4 w-4" />}
              >
                <span className="hidden sm:inline">Logout</span>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}

export default Header;