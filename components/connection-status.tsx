"use client"

import { useState, useEffect } from 'react'
import { Wifi, WifiOff, AlertCircle } from 'lucide-react'

interface ConnectionStatusProps {
  className?: string
}

export function ConnectionStatus({ className = "" }: ConnectionStatusProps) {
  const [isOnline, setIsOnline] = useState(true)
  const [rpcHealthy, setRpcHealthy] = useState(true)
  const [showTooltip, setShowTooltip] = useState(false)

  useEffect(() => {
    // Check network connectivity
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    // Check RPC health every 30 seconds
    const checkRpcHealth = async () => {
      try {
        const response = await fetch('/api/markets/sync', {
          method: 'HEAD',
          cache: 'no-cache'
        })
        setRpcHealthy(response.ok)
      } catch (error) {
        setRpcHealthy(false)
      }
    }

    checkRpcHealth()
    const interval = setInterval(checkRpcHealth, 30000)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      clearInterval(interval)
    }
  }, [])

  const getStatusColor = () => {
    if (!isOnline) return 'text-red-400'
    if (!rpcHealthy) return 'text-yellow-400'
    return 'text-green-400'
  }

  const getStatusIcon = () => {
    if (!isOnline) return <WifiOff className="w-4 h-4" />
    if (!rpcHealthy) return <AlertCircle className="w-4 h-4" />
    return <Wifi className="w-4 h-4" />
  }

  const getStatusText = () => {
    if (!isOnline) return 'Offline'
    if (!rpcHealthy) return 'RPC Issues'
    return 'Connected'
  }

  return (
    <div
      className={`relative inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-black/20 border transition-all duration-200 ${getStatusColor()} border-current/20 hover:bg-black/30 ${className}`}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      {getStatusIcon()}
      <span className="hidden sm:inline">{getStatusText()}</span>

      {showTooltip && (
        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-black/90 text-white text-xs rounded-lg border border-white/10 whitespace-nowrap z-50">
          {isOnline ? (
            rpcHealthy ? 'All systems operational' : 'RPC connection issues - some features may be slow'
          ) : 'No internet connection'}
          <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-black/90"></div>
        </div>
      )}
    </div>
  )
}