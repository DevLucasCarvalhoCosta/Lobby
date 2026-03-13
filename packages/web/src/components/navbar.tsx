'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useAuth } from '@/lib/auth-context';
import { LogIn, LogOut, User, Menu } from 'lucide-react';
import { useState } from 'react';

export function Navbar() {
  const { user, isLoading, login, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <nav className="bg-dota-card border-b border-dota-border sticky top-0 z-50">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 font-bold text-xl">
            <span className="text-radiant-light">⚔️</span>
            <span className="bg-gradient-to-r from-radiant-light to-gold bg-clip-text text-transparent">
              Dota League
            </span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-6">
            <Link
              href="/"
              className="text-dota-text-secondary hover:text-dota-text transition-colors"
            >
              Leaderboard
            </Link>
            <Link
              href="/matches"
              className="text-dota-text-secondary hover:text-dota-text transition-colors"
            >
              Matches
            </Link>
            <Link
              href="/players"
              className="text-dota-text-secondary hover:text-dota-text transition-colors"
            >
              Players
            </Link>

            {/* Auth */}
            {isLoading ? (
              <div className="w-8 h-8 rounded-full bg-dota-border animate-pulse" />
            ) : user ? (
              <div className="flex items-center gap-4">
                <Link
                  href={`/players/${user.steamId}`}
                  className="flex items-center gap-2 hover:opacity-80 transition-opacity"
                >
                  {user.avatar ? (
                    <Image
                      src={user.avatar}
                      alt={user.personaName}
                      width={32}
                      height={32}
                      className="rounded-full"
                    />
                  ) : (
                    <User className="w-8 h-8 p-1 bg-dota-border rounded-full" />
                  )}
                  <span className="text-sm font-medium">{user.personaName}</span>
                </Link>
                <button
                  onClick={logout}
                  className="p-2 text-dota-text-secondary hover:text-dire-light transition-colors"
                  title="Logout"
                >
                  <LogOut className="w-5 h-5" />
                </button>
              </div>
            ) : (
              <button
                onClick={login}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-radiant to-radiant-light text-black font-medium rounded-lg hover:opacity-90 transition-opacity"
              >
                <LogIn className="w-4 h-4" />
                Login with Steam
              </button>
            )}
          </div>

          {/* Mobile Menu Button */}
          <button
            className="md:hidden p-2"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            <Menu className="w-6 h-6" />
          </button>
        </div>

        {/* Mobile Navigation */}
        {mobileMenuOpen && (
          <div className="md:hidden py-4 border-t border-dota-border space-y-4">
            <Link
              href="/"
              className="block text-dota-text-secondary hover:text-dota-text"
              onClick={() => setMobileMenuOpen(false)}
            >
              Leaderboard
            </Link>
            <Link
              href="/matches"
              className="block text-dota-text-secondary hover:text-dota-text"
              onClick={() => setMobileMenuOpen(false)}
            >
              Matches
            </Link>
            <Link
              href="/players"
              className="block text-dota-text-secondary hover:text-dota-text"
              onClick={() => setMobileMenuOpen(false)}
            >
              Players
            </Link>
            {user ? (
              <div className="flex items-center justify-between pt-4 border-t border-dota-border">
                <Link
                  href={`/players/${user.steamId}`}
                  className="flex items-center gap-2"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {user.avatar ? (
                    <Image
                      src={user.avatar}
                      alt={user.personaName}
                      width={32}
                      height={32}
                      className="rounded-full"
                    />
                  ) : (
                    <User className="w-8 h-8" />
                  )}
                  <span>{user.personaName}</span>
                </Link>
                <button onClick={logout} className="text-dire-light">
                  Logout
                </button>
              </div>
            ) : (
              <button
                onClick={login}
                className="w-full py-2 bg-radiant text-black font-medium rounded-lg"
              >
                Login with Steam
              </button>
            )}
          </div>
        )}
      </div>
    </nav>
  );
}
