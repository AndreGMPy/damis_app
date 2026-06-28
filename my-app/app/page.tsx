/* eslint-disable react-hooks/set-state-in-effect, @typescript-eslint/no-explicit-any */
'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import Link from 'next/link'
import {
  TrendingUp,
  DollarSign,
  Package,
  ShoppingBag,
  Receipt,
  LogOut,
  CloudUpload,
  Sun,
  Moon,
  Sunset,
  CheckCircle2,
  Calculator,
  ClipboardCheck,
  Users,
  WalletCards,
  Sparkles,
  CalendarCheck,
} from 'lucide-react'
import { sincronizarVentasOffline } from '@/lib/sync'

type FiltroTiempo = 'hoy' | 'mes' | 'todo'

type VentaResumen = {
  id?: number | string
  created_at: string
  cantidad: number
  total: number
  producto_id?: number | null
  tipo?: string | null
  costo_total?: number | null
  ganancia?: number | null
}

type GastoResumen = {
  created_at: string
  monto: number
}

type CorteDiario = {
  id: number
  fecha: string
  created_at: string
  total_ventas: number
  ingresos_libres: number
  gastos: number
  costo_productos: number
  ganancia: number
  productos_vendidos: number
  movimientos: number
}

const formatoMoneda = (valor: number) =>
  valor.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })

const inicioDelDiaISO = () => {
  const hoy = new Date()
  return new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate()).toISOString()
}

const fechaLocalISO = () => {
  const hoy = new Date()
  const y = hoy.getFullYear()
  const m = String(hoy.getMonth() + 1).padStart(2, '0')
  const d = String(hoy.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

const fechaInicioFiltro = (filtro: FiltroTiempo) => {
  const hoy = new Date()
  if (filtro === 'hoy') return new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate()).toISOString()
  if (filtro === 'mes') return new Date(hoy.getFullYear(), hoy.getMonth(), 1).toISOString()
  return null
}

export default function DashboardPage() {
  const [ventasPeriodo, setVentasPeriodo] = useState<VentaResumen[]>([])
  const [gastosPeriodo, setGastosPeriodo] = useState<GastoResumen[]>([])
  const [ventasHoy, setVentasHoy] = useState<VentaResumen[]>([])
  const [gastosHoy, setGastosHoy] = useState<GastoResumen[]>([])
  const [alertasStock, setAlertasStock] = useState<any[]>([])
  const [ventasSemana, setVentasSemana] = useState<{ dia: string; total: number }[]>([])
  const [cortes, setCortes] = useState<CorteDiario[]>([])
  const [pedidosPendientes, setPedidosPendientes] = useState(0)
  const [fiadoPendiente, setFiadoPendiente] = useState(0)
  const [loading, setLoading] = useState(true)
  const [filtroTiempo, setFiltroTiempo] = useState<FiltroTiempo>('mes')

  const [pendientesCount, setPendientesCount] = useState(0)
  const [syncing, setSyncing] = useState(false)
  const [guardandoCorte, setGuardandoCorte] = useState(false)
  const [toast, setToast] = useState({ visible: false, mensaje: '' })

  const mostrarToast = (mensaje: string) => {
    setToast({ visible: true, mensaje })
    setTimeout(() => setToast({ visible: false, mensaje: '' }), 4000)
  }

  const hora = new Date().getHours()
  let saludo = '¡Hola'
  let IconoClima = Sun
  if (hora < 12) { saludo = '¡Buenos días'; IconoClima = Sun }
  else if (hora < 19) { saludo = '¡Buenas tardes'; IconoClima = Sunset }
  else { saludo = '¡Buenas noches'; IconoClima = Moon }

  const cargarVentas = async (fechaFiltro: string | null) => {
    let query = supabase
      .from('Ventas')
      .select('id, created_at, cantidad, total, producto_id, tipo, costo_total, ganancia')
      .order('created_at', { ascending: false })

    if (fechaFiltro) query = query.gte('created_at', fechaFiltro)

    const { data, error } = await query
    if (!error && data) return data as VentaResumen[]

    let fallback = supabase
      .from('Ventas')
      .select('id, created_at, cantidad, total, producto_id, tipo')
      .order('created_at', { ascending: false })
    if (fechaFiltro) fallback = fallback.gte('created_at', fechaFiltro)
    const { data: fallbackData } = await fallback
    return (fallbackData || []) as VentaResumen[]
  }

  const cargarGastos = async (fechaFiltro: string | null) => {
    let query = supabase.from('Gastos').select('created_at, monto').order('created_at', { ascending: false })
    if (fechaFiltro) query = query.gte('created_at', fechaFiltro)
    const { data } = await query
    return (data || []) as GastoResumen[]
  }

  useEffect(() => {
    const p = JSON.parse(localStorage.getItem('ventas_pendientes') || '[]')
    setPendientesCount(p.length)

    const cargarResumen = async () => {
      setLoading(true)
      const filtro = fechaInicioFiltro(filtroTiempo)
      const inicioHoy = inicioDelDiaISO()
      const inicioGrafica = new Date()
      inicioGrafica.setDate(inicioGrafica.getDate() - 6)
      inicioGrafica.setHours(0, 0, 0, 0)

      const [ventasData, gastosData, ventasHoyData, gastosHoyData, ventasGrafica, stockBajo] = await Promise.all([
        cargarVentas(filtro),
        cargarGastos(filtro),
        cargarVentas(inicioHoy),
        cargarGastos(inicioHoy),
        cargarVentas(inicioGrafica.toISOString()),
        supabase.from('Inventario').select('nombre, stock').lte('stock', 3).order('stock', { ascending: true })
      ])

      setVentasPeriodo(ventasData)
      setGastosPeriodo(gastosData)
      setVentasHoy(ventasHoyData)
      setGastosHoy(gastosHoyData)
      setAlertasStock(stockBajo.data || [])

      const ultimos7Dias = Array.from({ length: 7 }).map((_, i) => {
        const d = new Date()
        d.setDate(d.getDate() - (6 - i))
        d.setHours(0, 0, 0, 0)
        return d
      })

      const ventasPorDia = ultimos7Dias.map(fecha => {
        const ventasDelDia = ventasGrafica.filter(v => {
          const fechaVenta = new Date(v.created_at)
          return fechaVenta.getFullYear() === fecha.getFullYear()
            && fechaVenta.getMonth() === fecha.getMonth()
            && fechaVenta.getDate() === fecha.getDate()
        })

        return {
          dia: fecha.toLocaleDateString('es-MX', { weekday: 'short' }),
          total: ventasDelDia.reduce((acc, curr) => acc + Number(curr.total), 0)
        }
      })

      setVentasSemana(ventasPorDia)

      const { data: cortesData } = await supabase
        .from('CortesDiarios')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(3)
      setCortes((cortesData || []) as CorteDiario[])

      const { data: pedidosData } = await supabase
        .from('Pedidos')
        .select('saldo, estado, estado_pago')
        .neq('estado', 'entregado')

      if (pedidosData) {
        setPedidosPendientes(pedidosData.length)
        setFiadoPendiente(pedidosData.reduce((acc: number, p: any) => acc + (p.estado_pago === 'pagado' ? 0 : Number(p.saldo || 0)), 0))
      } else {
        setPedidosPendientes(0)
        setFiadoPendiente(0)
      }

      setLoading(false)
    }

    cargarResumen()
  }, [filtroTiempo])

  const resumen = useMemo(() => {
    const ingresos = ventasPeriodo.reduce((acc, curr) => acc + Number(curr.total), 0)
    const gastos = gastosPeriodo.reduce((acc, curr) => acc + Number(curr.monto), 0)
    const costoProductos = ventasPeriodo.reduce((acc, curr) => acc + Number(curr.costo_total || 0), 0)
    const gananciaVentas = ventasPeriodo.reduce((acc, curr) => acc + Number(curr.ganancia ?? (Number(curr.total) - Number(curr.costo_total || 0))), 0)
    const gananciaNeta = gananciaVentas - gastos
    const productosVendidos = ventasPeriodo.filter(v => v.producto_id).reduce((acc, curr) => acc + Number(curr.cantidad), 0)
    const ingresosLibres = ventasPeriodo.filter(v => !v.producto_id || v.tipo === 'propina' || v.tipo === 'libre').reduce((acc, curr) => acc + Number(curr.total), 0)
    return { ingresos, gastos, costoProductos, gananciaVentas, gananciaNeta, productosVendidos, ingresosLibres }
  }, [ventasPeriodo, gastosPeriodo])

  const corteHoy = useMemo(() => {
    const totalVentas = ventasHoy.reduce((acc, curr) => acc + Number(curr.total), 0)
    const ingresosLibres = ventasHoy.filter(v => !v.producto_id || v.tipo === 'propina' || v.tipo === 'libre').reduce((acc, curr) => acc + Number(curr.total), 0)
    const gastos = gastosHoy.reduce((acc, curr) => acc + Number(curr.monto), 0)
    const costoProductos = ventasHoy.reduce((acc, curr) => acc + Number(curr.costo_total || 0), 0)
    const gananciaVentas = ventasHoy.reduce((acc, curr) => acc + Number(curr.ganancia ?? (Number(curr.total) - Number(curr.costo_total || 0))), 0)
    const ganancia = gananciaVentas - gastos
    const productosVendidos = ventasHoy.filter(v => v.producto_id).reduce((acc, curr) => acc + Number(curr.cantidad), 0)
    return { totalVentas, ingresosLibres, gastos, costoProductos, ganancia, productosVendidos, movimientos: ventasHoy.length }
  }, [ventasHoy, gastosHoy])

  const maxVentaSemana = Math.max(...ventasSemana.map(v => v.total), 1)

  const handleSync = async () => {
    setSyncing(true)
    const res = await sincronizarVentasOffline()
    mostrarToast(res.message)

    if (res.success) {
      setPendientesCount(0)
      setTimeout(() => window.location.reload(), 1500)
    }
    setSyncing(false)
  }

  const guardarCorteDelDia = async () => {
    setGuardandoCorte(true)
    const payload = {
      fecha: fechaLocalISO(),
      total_ventas: corteHoy.totalVentas,
      ingresos_libres: corteHoy.ingresosLibres,
      gastos: corteHoy.gastos,
      costo_productos: corteHoy.costoProductos,
      ganancia: corteHoy.ganancia,
      productos_vendidos: corteHoy.productosVendidos,
      movimientos: corteHoy.movimientos,
    }

    const { error } = await supabase.from('CortesDiarios').insert([payload])
    if (error) {
      console.error(error)
      mostrarToast('⚠️ Falta ejecutar el SQL nuevo para guardar cortes.')
      setGuardandoCorte(false)
      return
    }

    mostrarToast('✅ Corte del día guardado.')
    const { data } = await supabase.from('CortesDiarios').select('*').order('created_at', { ascending: false }).limit(3)
    setCortes((data || []) as CorteDiario[])
    setGuardandoCorte(false)
  }

  return (
    <div className="app-shell p-4 sm:p-6 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500 relative">
      <div className={`fixed bottom-6 right-6 z-50 transition-all duration-500 ease-out transform ${toast.visible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0 pointer-events-none'}`}>
        <div className="bg-primary text-white px-6 py-4 rounded-2xl shadow-xl font-medium flex items-center gap-3">
          <CheckCircle2 size={20} /> {toast.mensaje}
        </div>
      </div>

      <section className="hero-card overflow-hidden rounded-[2.2rem] p-6 sm:p-8 shadow-sm border border-white/70 relative">
        <div className="absolute -top-20 -right-16 h-44 w-44 rounded-full bg-white/50 blur-2xl" />
        <div className="relative flex flex-col lg:flex-row lg:items-end lg:justify-between gap-5">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/70 px-4 py-2 text-sm font-black text-primary shadow-sm">
              <Sparkles size={16} /> Ventas D Damis
            </div>
            <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-foreground flex flex-wrap items-center gap-3">
              {saludo}, Damaris <IconoClima className="text-amber-500" size={34} />
            </h1>
            <p className="text-muted-foreground text-base sm:text-lg max-w-2xl">
              Panel completo para ventas, gastos, pedidos, fiados, inventario y corte del día.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <select
              value={filtroTiempo}
              onChange={(e) => setFiltroTiempo(e.target.value as FiltroTiempo)}
              className="h-12 px-4 rounded-2xl border border-white/70 bg-white/80 text-sm outline-none focus:ring-2 focus:ring-primary/50 transition-all font-black text-foreground shadow-sm cursor-pointer"
            >
              <option value="hoy">📅 Solo hoy</option>
              <option value="mes">📊 Este mes</option>
              <option value="todo">🗄️ Todos los tiempos</option>
            </select>
            <Link href="/ventas" className="w-full sm:w-auto">
              <Button className="w-full h-12 rounded-2xl font-black shadow-lg shadow-primary/20">Registrar venta</Button>
            </Link>
          </div>
        </div>
      </section>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Skeleton className="h-32 w-full rounded-3xl" />
          <Skeleton className="h-32 w-full rounded-3xl" />
          <Skeleton className="h-32 w-full rounded-3xl" />
          <Skeleton className="h-32 w-full rounded-3xl" />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <Card className="metric-card p-5 rounded-3xl">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-green-100 text-green-600 rounded-2xl"><DollarSign size={20} /></div>
              <h3 className="text-sm font-black text-muted-foreground">Ingresos</h3>
            </div>
            <p className="text-2xl sm:text-3xl font-black text-green-600">{formatoMoneda(resumen.ingresos)}</p>
          </Card>

          <Card className="metric-card p-5 rounded-3xl">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-red-100 text-red-500 rounded-2xl"><Receipt size={20} /></div>
              <h3 className="text-sm font-black text-muted-foreground">Gastos</h3>
            </div>
            <p className="text-2xl sm:text-3xl font-black text-destructive">-{formatoMoneda(resumen.gastos)}</p>
          </Card>

          <Card className="metric-card p-5 rounded-3xl">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-primary/15 text-primary rounded-2xl"><Calculator size={20} /></div>
              <h3 className="text-sm font-black text-muted-foreground">Ganancia real</h3>
            </div>
            <p className={`text-2xl sm:text-3xl font-black ${resumen.gananciaNeta >= 0 ? 'text-primary' : 'text-destructive'}`}>{formatoMoneda(resumen.gananciaNeta)}</p>
            <p className="text-xs text-muted-foreground mt-1">Después de costos y gastos</p>
          </Card>

          <Card className="metric-card p-5 rounded-3xl">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-amber-100 text-amber-600 rounded-2xl"><WalletCards size={20} /></div>
              <h3 className="text-sm font-black text-muted-foreground">Fiados pendientes</h3>
            </div>
            <p className="text-2xl sm:text-3xl font-black text-amber-600">{formatoMoneda(fiadoPendiente)}</p>
            <p className="text-xs text-muted-foreground mt-1">{pedidosPendientes} pedidos sin cerrar</p>
          </Card>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        <Card className="soft-card p-6 rounded-3xl xl:col-span-7 flex flex-col justify-between">
          <div>
            <h2 className="text-xl font-black text-foreground mb-1 flex items-center gap-2">
              <TrendingUp className="text-primary" size={24} /> Ventas últimos 7 días
            </h2>
            <p className="text-sm text-muted-foreground mb-8">Comportamiento diario de ingresos.</p>
          </div>

          {loading ? (
            <Skeleton className="h-48 w-full rounded-xl" />
          ) : (
            <div className="h-52 flex items-end justify-between gap-2 mt-auto">
              {ventasSemana.map((dia, idx) => (
                <div key={idx} className="relative group w-full flex flex-col items-center justify-end h-full">
                  <div className="absolute -top-10 opacity-0 group-hover:opacity-100 transition-opacity bg-foreground text-background text-xs font-bold py-1 px-2 rounded-lg pointer-events-none whitespace-nowrap z-10">
                    {formatoMoneda(dia.total)}
                  </div>
                  <div
                    className="w-full max-w-[42px] bg-gradient-to-t from-primary to-pink-300 shadow-sm border border-primary/20 transition-all duration-500 rounded-t-2xl"
                    style={{ height: `${(dia.total / maxVentaSemana) * 100}%`, minHeight: '8px' }}
                  />
                  <span className="text-xs font-black text-muted-foreground mt-3 uppercase tracking-wider">{dia.dia}</span>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="soft-card p-6 rounded-3xl xl:col-span-5 space-y-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-black text-foreground flex items-center gap-2"><ClipboardCheck className="text-primary" size={23} /> Corte del día</h2>
              <p className="text-sm text-muted-foreground mt-1">Guarda el resumen cuando termine de vender.</p>
            </div>
            <CalendarCheck className="text-primary/60" size={28} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-primary/10 p-4"><p className="text-xs font-black text-muted-foreground">Ventas</p><p className="text-lg font-black text-primary">{formatoMoneda(corteHoy.totalVentas)}</p></div>
            <div className="rounded-2xl bg-red-50 p-4"><p className="text-xs font-black text-muted-foreground">Gastos</p><p className="text-lg font-black text-destructive">-{formatoMoneda(corteHoy.gastos)}</p></div>
            <div className="rounded-2xl bg-amber-50 p-4"><p className="text-xs font-black text-muted-foreground">Propinas/libres</p><p className="text-lg font-black text-amber-600">{formatoMoneda(corteHoy.ingresosLibres)}</p></div>
            <div className="rounded-2xl bg-green-50 p-4"><p className="text-xs font-black text-muted-foreground">Ganancia</p><p className={`text-lg font-black ${corteHoy.ganancia >= 0 ? 'text-green-600' : 'text-destructive'}`}>{formatoMoneda(corteHoy.ganancia)}</p></div>
          </div>

          <div className="rounded-2xl bg-secondary/40 p-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-black text-foreground">Productos vendidos: {corteHoy.productosVendidos}</p>
              <p className="text-xs text-muted-foreground">Movimientos registrados: {corteHoy.movimientos}</p>
            </div>
            <Button onClick={guardarCorteDelDia} disabled={guardandoCorte || corteHoy.movimientos === 0} className="rounded-2xl font-black">
              {guardandoCorte ? 'Guardando...' : 'Cerrar día'}
            </Button>
          </div>

          {cortes.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-black text-muted-foreground">Últimos cortes guardados</p>
              {cortes.map((corte) => (
                <div key={corte.id} className="flex justify-between items-center rounded-2xl border border-border/50 bg-white/70 p-3">
                  <div>
                    <p className="text-sm font-black text-foreground">{new Date(corte.fecha).toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })}</p>
                    <p className="text-xs text-muted-foreground">{corte.productos_vendidos} pzs · {corte.movimientos} mov.</p>
                  </div>
                  <p className="font-black text-primary">{formatoMoneda(Number(corte.ganancia))}</p>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <Link href="/ventas" className="quick-card group"><ShoppingBag className="text-primary" /><span>Registrar venta</span><small>Cobrar productos o propinas</small></Link>
          <Link href="/ventas?historial=todo" className="quick-card group"><Receipt className="text-primary" /><span>Todas las ventas</span><small>Historial completo</small></Link>
          <Link href="/pedidos" className="quick-card group"><Users className="text-primary" /><span>Pedidos y fiados</span><small>Clientes, anticipos y saldos</small></Link>
          <Link href="/gastos" className="quick-card group"><Calculator className="text-primary" /><span>Gastos</span><small>Costos recurrentes</small></Link>
        </div>

        <div className="lg:col-span-4 space-y-4">
          <Card className="soft-card p-5 rounded-3xl">
            <h2 className="text-lg font-black text-foreground mb-4 flex items-center gap-2">
              <Package className="text-amber-500" size={20} /> Alertas de stock
            </h2>
            {loading ? (
              <Skeleton className="h-20 w-full rounded-xl" />
            ) : alertasStock.length === 0 ? (
              <div className="p-4 bg-green-50 rounded-2xl border border-green-100 text-sm text-green-700 font-bold">
                ✨ Todo bien, no hay productos bajos.
              </div>
            ) : (
              <div className="space-y-3 max-h-[170px] overflow-y-auto pr-2">
                {alertasStock.map((producto, index) => (
                  <div key={index} className="flex justify-between items-center p-3 bg-red-50/70 rounded-2xl border border-red-100">
                    <span className="font-black text-sm text-red-900 truncate">{producto.nombre}</span>
                    <span className="text-xs font-black text-red-700 bg-red-200 px-2 py-1 rounded-lg">
                      {producto.stock} {producto.stock === 1 ? 'pz' : 'pzs'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card className="soft-card p-5 rounded-3xl space-y-3">
            {pendientesCount > 0 && (
              <Button onClick={handleSync} disabled={syncing} className="w-full rounded-2xl h-12 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-black shadow-lg shadow-amber-500/30 animate-pulse border-none">
                <CloudUpload size={19} className="mr-2" /> {syncing ? 'Subiendo...' : `Sincronizar ${pendientesCount} tickets`}
              </Button>
            )}
            <Link href="/inventario"><Button variant="outline" className="w-full rounded-2xl text-md h-12 border-primary/20 text-primary hover:bg-primary/10 font-black">📦 Ver inventario</Button></Link>
            <Button variant="ghost" onClick={() => supabase.auth.signOut()} className="w-full rounded-2xl text-md h-12 text-destructive hover:bg-destructive/10 font-black">
              <LogOut size={18} className="mr-2" /> Cerrar sesión
            </Button>
          </Card>
        </div>
      </div>
    </div>
  )
}
