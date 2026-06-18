'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import Link from 'next/link'
import { TrendingUp, DollarSign, Package, ShoppingBag, Receipt, LogOut, CloudUpload, Sun, Moon, Sunset, CheckCircle2 } from 'lucide-react'
import { sincronizarVentasOffline } from '@/lib/sync'

export default function DashboardPage() {
  const [ingresos, setIngresos] = useState(0)
  const [gastos, setGastos] = useState(0)
  const [alertasStock, setAlertasStock] = useState<any[]>([])
  const [ventasSemana, setVentasSemana] = useState<{ dia: string; total: number }[]>([])
  const [loading, setLoading] = useState(true)
  const [filtroTiempo, setFiltroTiempo] = useState('mes')

  // Estados de Sincronización y UI
  const [pendientesCount, setPendientesCount] = useState(0)
  const [syncing, setSyncing] = useState(false)
  const [toast, setToast] = useState({ visible: false, mensaje: '' })

  const mostrarToast = (mensaje: string) => {
    setToast({ visible: true, mensaje })
    setTimeout(() => setToast({ visible: false, mensaje: '' }), 4000)
  }

  // Lógica del saludo dinámico
  const hora = new Date().getHours()
  let saludo = '¡Hola'
  let IconoClima = Sun
  if (hora < 12) { saludo = '¡Buenos días'; IconoClima = Sun }
  else if (hora < 19) { saludo = '¡Buenas tardes'; IconoClima = Sunset }
  else { saludo = '¡Buenas noches'; IconoClima = Moon }

  useEffect(() => {
    // Revisar si hay ventas guardadas en el celular (Offline)
    const p = JSON.parse(localStorage.getItem('ventas_pendientes') || '[]')
    setPendientesCount(p.length)

    const cargarResumen = async () => {
      setLoading(true)

      let fechaFiltro = null
      const hoy = new Date()

      if (filtroTiempo === 'hoy') {
        fechaFiltro = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate()).toISOString()
      } else if (filtroTiempo === 'mes') {
        fechaFiltro = new Date(hoy.getFullYear(), hoy.getMonth(), 1).toISOString()
      }

      let queryVentas = supabase.from('Ventas').select('total, created_at')
      let queryGastos = supabase.from('Gastos').select('monto')

      if (fechaFiltro) {
        queryVentas = queryVentas.gte('created_at', fechaFiltro)
        queryGastos = queryGastos.gte('created_at', fechaFiltro)
      }

      const [{ data: ventas }, { data: gastosData }, { data: stockBajo }] = await Promise.all([
        queryVentas,
        queryGastos,
        supabase.from('Inventario').select('nombre, stock').lte('stock', 3).order('stock', { ascending: true })
      ])

      const totalIngresos = ventas?.reduce((acc, curr) => acc + Number(curr.total), 0) || 0
      const totalGastos = gastosData?.reduce((acc, curr) => acc + Number(curr.monto), 0) || 0

      setIngresos(totalIngresos)
      setGastos(totalGastos)
      setAlertasStock(stockBajo || [])

      // CÁLCULO PARA LA GRÁFICA (Últimos 7 días)
      const ultimos7Dias = Array.from({ length: 7 }).map((_, i) => {
        const d = new Date()
        d.setDate(d.getDate() - (6 - i))
        return d
      })

      const ventasPorDia = ultimos7Dias.map(fecha => {
        const ventasDelDia = ventas?.filter(v => {
          const fechaVenta = new Date(v.created_at)
          return fechaVenta.getDate() === fecha.getDate() && fechaVenta.getMonth() === fecha.getMonth()
        }) || []

        return {
          dia: fecha.toLocaleDateString('es-MX', { weekday: 'short' }),
          total: ventasDelDia.reduce((acc, curr) => acc + Number(curr.total), 0)
        }
      })

      setVentasSemana(ventasPorDia)
      setLoading(false)
    }

    cargarResumen()
  }, [filtroTiempo])

  const gananciaNeta = ingresos - gastos
  const maxVentaSemana = Math.max(...ventasSemana.map(v => v.total), 1)

  // FUNCIÓN PARA EL BOTÓN DE SINCRONIZAR
  const handleSync = async () => {
    setSyncing(true)
    const res = await sincronizarVentasOffline()
    mostrarToast(res.message)

    if (res.success) {
      setPendientesCount(0)
      // Recargamos la página después de 2 segundos para que se actualicen las gráficas con las nuevas ventas
      setTimeout(() => window.location.reload(), 2000)
    }
    setSyncing(false)
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500 relative">

      {/* Toast Notificación */}
      <div className={`fixed bottom-6 right-6 z-50 transition-all duration-500 ease-out transform ${toast.visible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0 pointer-events-none'}`}>
        <div className="bg-primary text-white px-6 py-4 rounded-2xl shadow-xl font-medium flex items-center gap-3">
          <CheckCircle2 size={20} /> {toast.mensaje}
        </div>
      </div>

      <div className="flex flex-col md:flex-row md:justify-between md:items-end gap-4">
        <div>
          <h1 className="text-4xl font-bold tracking-tight text-primary flex items-center gap-3">
            {saludo}, Damaris! <IconoClima className="text-amber-500" size={32} />
          </h1>
          <p className="text-muted-foreground mt-2 text-lg">Resumen financiero y métricas de tu negocio.</p>
        </div>

        <div className="space-y-1.5">
          <select
            value={filtroTiempo}
            onChange={(e) => setFiltroTiempo(e.target.value)}
            className="w-full md:w-48 h-12 px-4 rounded-2xl border border-input bg-white text-sm outline-none focus:ring-2 focus:ring-primary/50 transition-all font-medium text-foreground shadow-sm cursor-pointer"
          >
            <option value="hoy">📅 Solo Hoy</option>
            <option value="mes">📊 Este Mes</option>
            <option value="todo">🗄️ Histórico Total</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Skeleton className="h-32 w-full rounded-3xl" />
          <Skeleton className="h-32 w-full rounded-3xl" />
          <Skeleton className="h-32 w-full rounded-3xl" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="p-6 rounded-3xl shadow-sm border-border/50 bg-white hover:shadow-md transition-all">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-green-100 text-green-600 rounded-xl">
                <DollarSign size={20} />
              </div>
              <h3 className="text-sm font-semibold text-muted-foreground">Ingresos Totales</h3>
            </div>
            <p className="text-3xl font-black text-green-500">${ingresos.toFixed(2)} MXN</p>
          </Card>

          <Card className="p-6 rounded-3xl shadow-sm border-border/50 bg-white hover:shadow-md transition-all">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-red-100 text-red-500 rounded-xl">
                <Receipt size={20} />
              </div>
              <h3 className="text-sm font-semibold text-muted-foreground">Gastos Operativos</h3>
            </div>
            <p className="text-3xl font-black text-destructive">-${gastos.toFixed(2)} MXN</p>
          </Card>

          <Card className={`p-6 rounded-3xl shadow-sm border-border/50 hover:shadow-md transition-all ${gananciaNeta >= 0 ? 'bg-primary/5 border-primary/20' : 'bg-destructive/5'}`}>
            <div className="flex items-center gap-3 mb-2">
              <div className={`p-2 rounded-xl ${gananciaNeta >= 0 ? 'bg-primary/20 text-primary' : 'bg-red-200 text-destructive'}`}>
                <TrendingUp size={20} />
              </div>
              <h3 className="text-sm font-semibold text-muted-foreground">Ganancia Neta</h3>
            </div>
            <p className={`text-3xl font-black ${gananciaNeta >= 0 ? 'text-primary' : 'text-destructive'}`}>
              ${gananciaNeta.toFixed(2)} MXN
            </p>
          </Card>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pt-4">

        {/* GRÁFICA INTERACTIVA MEJORADA */}
        <Card className="p-6 rounded-3xl shadow-sm border-border/50 bg-white lg:col-span-8 flex flex-col justify-between">
          <div>
            <h2 className="text-xl font-bold text-foreground mb-1 flex items-center gap-2">
              <TrendingUp className="text-primary" size={24} /> Ventas Últimos 7 Días
            </h2>
            <p className="text-sm text-muted-foreground mb-8">Comportamiento diario de tus ingresos.</p>
          </div>

          {loading ? (
            <Skeleton className="h-48 w-full rounded-xl" />
          ) : (
            <div className="h-48 flex items-end justify-between gap-2 mt-auto">
              {ventasSemana.map((dia, idx) => (
                <div key={idx} className="relative group w-full flex flex-col items-center justify-end h-full">
                  <div className="absolute -top-10 opacity-0 group-hover:opacity-100 transition-opacity bg-foreground text-background text-xs font-bold py-1 px-2 rounded-lg pointer-events-none whitespace-nowrap z-10">
                    ${dia.total.toFixed(2)}
                  </div>
                  <div
                    className="w-full max-w-[40px] bg-primary/60 hover:bg-primary shadow-sm border border-primary/20 transition-all duration-500 rounded-t-xl"
                    style={{ height: `${(dia.total / maxVentaSemana) * 100}%`, minHeight: '4px' }}
                  ></div>
                  <span className="text-xs font-medium text-muted-foreground mt-3 uppercase tracking-wider">{dia.dia}</span>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* ACCIONES Y ALERTAS */}
        <div className="lg:col-span-4 space-y-6">
          <Card className="p-6 rounded-3xl shadow-sm border-border/50 bg-white">
            <h2 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
              <ShoppingBag className="text-primary" size={20} /> Acciones Rápidas
            </h2>
            <div className="flex flex-col space-y-3">

              {/* BOTÓN DE SINCRONIZACIÓN (Solo aparece si hay ventas sin internet) */}
              {pendientesCount > 0 && (
                <Button
                  onClick={handleSync}
                  disabled={syncing}
                  className="w-full rounded-2xl text-md h-14 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-black shadow-lg shadow-amber-500/30 animate-pulse border-none"
                >
                  <CloudUpload size={20} className="mr-2" />
                  {syncing ? 'Subiendo...' : `Sincronizar ${pendientesCount} Tickets`}
                </Button>
              )}

              <Link href="/ventas">
                <Button className="w-full rounded-2xl text-md h-12 shadow-sm">🛍️ Registrar Venta</Button>
              </Link>
              <Link href="/gastos">
                <Button variant="secondary" className="w-full rounded-2xl text-md h-12 bg-secondary hover:bg-primary/10 text-primary">💸 Registrar Gasto</Button>
              </Link>
              <Link href="/inventario">
                <Button variant="outline" className="w-full rounded-2xl text-md h-12 border-primary/20 text-primary hover:bg-primary/10">📦 Ver Inventario</Button>
              </Link>

              <Button
                variant="ghost"
                onClick={() => supabase.auth.signOut()}
                className="w-full rounded-2xl text-md h-12 text-destructive hover:bg-destructive/10 font-bold mt-2"
              >
                <LogOut size={18} className="mr-2" /> Cerrar Sesión
              </Button>
            </div>
          </Card>

          <Card className="p-6 rounded-3xl shadow-sm border-border/50 bg-white">
            <h2 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
              <Package className="text-amber-500" size={20} /> Alertas de Stock
            </h2>
            {loading ? (
              <Skeleton className="h-20 w-full rounded-xl" />
            ) : alertasStock.length === 0 ? (
              <div className="p-4 bg-green-50 rounded-2xl border border-green-100 text-sm text-green-700 font-medium">
                ✨ ¡Todo excelente! Tienes buen stock general.
              </div>
            ) : (
              <div className="space-y-3 max-h-[150px] overflow-y-auto pr-2">
                {alertasStock.map((producto, index) => (
                  <div key={index} className="flex justify-between items-center p-3 bg-red-50/50 rounded-2xl border border-red-100">
                    <span className="font-semibold text-sm text-red-900 truncate">{producto.nombre}</span>
                    <span className="text-xs font-black text-red-700 bg-red-200 px-2 py-1 rounded-lg">
                      {producto.stock} {producto.stock === 1 ? 'pz' : 'pzs'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

      </div>
    </div>
  )
}