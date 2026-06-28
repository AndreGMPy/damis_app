/* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps, react-hooks/purity, @typescript-eslint/no-explicit-any */
'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import {
    Search,
    ShoppingCart,
    Trash2,
    CheckCircle2,
    ArrowLeft,
    Wifi,
    WifiOff,
    CloudOff,
    HandCoins,
    CalendarDays,
    ListChecks,
    ReceiptText,
    MessageCircle,
    Copy,
    Sparkles,
} from 'lucide-react'
import Link from 'next/link'

interface Producto {
    id: number
    nombre: string
    precio_venta: number
    precio_costo: number
    stock: number
}

interface VentaRegistrada {
    id: number | string
    created_at: string
    cantidad: number
    total: number
    producto_id: number | null
    costo_total?: number | null
    ganancia?: number | null
    tipo?: string | null
    concepto?: string | null
    Inventario?: { nombre: string } | { nombre: string }[] | null
    nombre_offline?: string
    offline?: boolean
}

interface ItemCarrito {
    producto_id: number | null
    nombre: string
    cantidad: number
    precio: number
    costo_unitario: number
    subtotal: number
    costo_total: number
    ganancia: number
    stock_disponible: number
    concepto?: string
    tipo?: string
    libre?: boolean
}

type FiltroHistorial = 'hoy' | 'semana' | 'mes' | 'todo'

type TicketCompartible = {
    fecha: string
    items: ItemCarrito[]
    total: number
    costoTotal: number
    ganancia: number
}

const formatoMoneda = (valor: number) =>
    valor.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })

const nombreDeVenta = (venta: VentaRegistrada) => {
    const inventario = Array.isArray(venta.Inventario) ? venta.Inventario[0] : venta.Inventario
    return inventario?.nombre || venta.concepto || venta.nombre_offline || 'Ingreso libre'
}

const fechaInicioFiltro = (filtro: FiltroHistorial) => {
    const hoy = new Date()
    if (filtro === 'hoy') return new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate()).toISOString()
    if (filtro === 'semana') {
        const inicio = new Date(hoy)
        inicio.setDate(hoy.getDate() - 6)
        inicio.setHours(0, 0, 0, 0)
        return inicio.toISOString()
    }
    if (filtro === 'mes') return new Date(hoy.getFullYear(), hoy.getMonth(), 1).toISOString()
    return null
}

const crearTextoTicket = (ticket: TicketCompartible) => {
    const lineas = ticket.items.map(item => `• ${item.cantidad} x ${item.nombre}: ${formatoMoneda(item.subtotal)}`)
    return [
        'Gracias por tu compra 💕',
        '',
        'Ticket:',
        ...lineas,
        '',
        `Total: ${formatoMoneda(ticket.total)}`,
        `Fecha: ${new Date(ticket.fecha).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' })}`,
    ].join('\n')
}

export default function VentasPage() {
    const [productos, setProductos] = useState<Producto[]>([])
    const [busquedaPOS, setBusquedaPOS] = useState('')
    const [ventas, setVentas] = useState<VentaRegistrada[]>([])
    const [loading, setLoading] = useState(true)

    const [isOnline, setIsOnline] = useState(true)
    const [ventasPendientesCount, setVentasPendientesCount] = useState(0)

    const [carrito, setCarrito] = useState<ItemCarrito[]>([])
    const [productoSeleccionadoId, setProductoSeleccionadoId] = useState('')
    const [cantidad, setCantidad] = useState('1')
    const [cobrando, setCobrando] = useState(false)
    const [toast, setToast] = useState({ visible: false, mensaje: '' })
    const [ultimoTicket, setUltimoTicket] = useState<TicketCompartible | null>(null)

    const [filtroHistorial, setFiltroHistorial] = useState<FiltroHistorial>('hoy')
    const [openIngresoLibre, setOpenIngresoLibre] = useState(false)
    const [conceptoLibre, setConceptoLibre] = useState('Propina')
    const [montoLibre, setMontoLibre] = useState('')
    const [tipoLibre, setTipoLibre] = useState('propina')
    const [guardandoLibre, setGuardandoLibre] = useState(false)

    const mostrarToast = (mensaje: string) => {
        setToast({ visible: true, mensaje })
        setTimeout(() => setToast({ visible: false, mensaje: '' }), 3000)
    }

    useEffect(() => {
        if (typeof window !== 'undefined') {
            const params = new URLSearchParams(window.location.search)
            const historial = params.get('historial') as FiltroHistorial | null
            if (historial && ['hoy', 'semana', 'mes', 'todo'].includes(historial)) setFiltroHistorial(historial)
        }
    }, [])

    useEffect(() => {
        if (typeof window !== 'undefined') {
            setIsOnline(navigator.onLine)
            const handleOnline = () => setIsOnline(true)
            const handleOffline = () => setIsOnline(false)
            window.addEventListener('online', handleOnline)
            window.addEventListener('offline', handleOffline)
            return () => {
                window.removeEventListener('online', handleOnline)
                window.removeEventListener('offline', handleOffline)
            }
        }
    }, [])

    const cargarProductos = async () => {
        if (navigator.onLine) {
            const { data: prodData } = await supabase.from('Inventario').select('*').order('nombre', { ascending: true })
            if (prodData) {
                setProductos(prodData as Producto[])
                localStorage.setItem('inventario_cache', JSON.stringify(prodData))
            }
        } else {
            const cache = localStorage.getItem('inventario_cache')
            if (cache) setProductos(JSON.parse(cache))
        }
    }

    const cargarDatos = async () => {
        setLoading(true)
        await cargarProductos()

        let ventasMostradas: VentaRegistrada[] = []
        const fechaFiltro = fechaInicioFiltro(filtroHistorial)

        if (navigator.onLine) {
            let query = supabase
                .from('Ventas')
                .select('id, created_at, cantidad, total, producto_id, tipo, concepto, costo_total, ganancia, Inventario(nombre)')
                .order('created_at', { ascending: false })

            if (fechaFiltro) query = query.gte('created_at', fechaFiltro)

            const { data, error } = await query

            if (!error && data) {
                ventasMostradas = data as unknown as VentaRegistrada[]
            } else {
                let queryFallback = supabase
                    .from('Ventas')
                    .select('id, created_at, cantidad, total, producto_id, tipo, concepto, Inventario(nombre)')
                    .order('created_at', { ascending: false })

                if (fechaFiltro) queryFallback = queryFallback.gte('created_at', fechaFiltro)
                const { data: fallbackData } = await queryFallback
                if (fallbackData) ventasMostradas = fallbackData as unknown as VentaRegistrada[]
            }
        }

        const pendientesGuardadas = JSON.parse(localStorage.getItem('ventas_pendientes') || '[]')
        setVentasPendientesCount(pendientesGuardadas.length)

        const ventasOfflineParaTabla = pendientesGuardadas.flatMap((ticket: any) =>
            ticket.items
                .filter(() => {
                    const fechaFiltroLocal = fechaInicioFiltro(filtroHistorial)
                    return !fechaFiltroLocal || new Date(ticket.fecha) >= new Date(fechaFiltroLocal)
                })
                .map((item: any) => ({
                    id: `offline-${ticket.id_local}-${item.producto_id || item.concepto || Math.random()}`,
                    created_at: ticket.fecha,
                    cantidad: item.cantidad,
                    total: item.subtotal,
                    producto_id: item.producto_id || null,
                    costo_total: item.costo_total || 0,
                    ganancia: item.ganancia ?? (Number(item.subtotal || 0) - Number(item.costo_total || 0)),
                    tipo: item.tipo || (item.libre ? 'libre' : 'producto'),
                    concepto: item.concepto || item.nombre,
                    nombre_offline: item.nombre,
                    offline: true
                }))
        )

        setVentas([...ventasOfflineParaTabla, ...ventasMostradas])
        setLoading(false)
    }

    useEffect(() => { cargarDatos() }, [isOnline, filtroHistorial])

    const productosFiltradosParaSelect = productos.filter(p =>
        p.nombre.toLowerCase().includes(busquedaPOS.toLowerCase())
    )

    const resumenHistorial = useMemo(() => {
        const total = ventas.reduce((acc, curr) => acc + Number(curr.total), 0)
        const costo = ventas.reduce((acc, curr) => acc + Number(curr.costo_total || 0), 0)
        const ganancia = ventas.reduce((acc, curr) => acc + Number(curr.ganancia ?? (Number(curr.total) - Number(curr.costo_total || 0))), 0)
        const ventasProducto = ventas.filter(v => v.producto_id).length
        const ingresosLibres = ventas.filter(v => !v.producto_id || v.tipo === 'libre' || v.tipo === 'propina').length
        return { total, costo, ganancia, ventasProducto, ingresosLibres, cantidad: ventas.length }
    }, [ventas])

    const handleAgregarAlCarrito = (e: React.FormEvent) => {
        e.preventDefault()
        const prodId = parseInt(productoSeleccionadoId)
        const cant = parseInt(cantidad)
        if (!prodId || !cant || cant <= 0) return

        const productoDb = productos.find(p => p.id === prodId)
        if (!productoDb) return

        const itemExistente = carrito.find(item => item.producto_id === prodId)
        const cantidadTotalProyectada = itemExistente ? itemExistente.cantidad + cant : cant

        if (productoDb.stock < cantidadTotalProyectada) {
            alert(`¡Stock insuficiente! Solo quedan ${productoDb.stock} pzs de ${productoDb.nombre}.`)
            return
        }

        const costoUnitario = Number(productoDb.precio_costo || 0)
        const precioVenta = Number(productoDb.precio_venta || 0)

        if (itemExistente) {
            setCarrito(carrito.map(item => {
                if (item.producto_id !== prodId) return item
                const nuevaCantidad = item.cantidad + cant
                const subtotal = nuevaCantidad * item.precio
                const costoTotal = nuevaCantidad * item.costo_unitario
                return { ...item, cantidad: nuevaCantidad, subtotal, costo_total: costoTotal, ganancia: subtotal - costoTotal }
            }))
        } else {
            const subtotal = cant * precioVenta
            const costoTotal = cant * costoUnitario
            setCarrito([{
                producto_id: prodId,
                nombre: productoDb.nombre,
                cantidad: cant,
                precio: precioVenta,
                costo_unitario: costoUnitario,
                subtotal,
                costo_total: costoTotal,
                ganancia: subtotal - costoTotal,
                stock_disponible: productoDb.stock,
                tipo: 'producto'
            }, ...carrito])
        }

        setProductoSeleccionadoId('')
        setCantidad('1')
        setBusquedaPOS('')
    }

    const quitarDelCarrito = (id: number | null, nombre: string) => {
        setCarrito(carrito.filter(item => item.producto_id !== id || item.nombre !== nombre))
    }

    const totalCarrito = carrito.reduce((acc, item) => acc + item.subtotal, 0)
    const costoTotalCarrito = carrito.reduce((acc, item) => acc + item.costo_total, 0)
    const gananciaCarrito = totalCarrito - costoTotalCarrito

    const guardarTicketOffline = (items: ItemCarrito[], mensaje = '💾 Guardado localmente (sin internet)') => {
        const ticketPendiente = {
            id_local: Date.now(),
            fecha: new Date().toISOString(),
            items
        }

        const pendientes = JSON.parse(localStorage.getItem('ventas_pendientes') || '[]')
        pendientes.push(ticketPendiente)
        localStorage.setItem('ventas_pendientes', JSON.stringify(pendientes))

        const cacheActual = JSON.parse(localStorage.getItem('inventario_cache') || '[]')
        const nuevoCache = cacheActual.map((p: Producto) => {
            const itemVendido = items.find(c => c.producto_id === p.id)
            if (itemVendido) return { ...p, stock: p.stock - itemVendido.cantidad }
            return p
        })
        localStorage.setItem('inventario_cache', JSON.stringify(nuevoCache))
        setProductos(nuevoCache)
        setUltimoTicket({ fecha: ticketPendiente.fecha, items, total: items.reduce((acc, i) => acc + i.subtotal, 0), costoTotal: items.reduce((acc, i) => acc + i.costo_total, 0), ganancia: items.reduce((acc, i) => acc + i.ganancia, 0) })
        mostrarToast(mensaje)
    }

    const insertarVentas = async (items: ItemCarrito[]) => {
        const nuevasVentas = items.map(item => ({
            producto_id: item.producto_id,
            cantidad: item.cantidad,
            total: item.subtotal,
            costo_total: item.costo_total,
            ganancia: item.ganancia,
            tipo: item.tipo || 'producto',
            concepto: item.nombre
        }))

        const { error } = await supabase.from('Ventas').insert(nuevasVentas)
        if (!error) return null

        const fallbackVentas = items.map(item => ({
            producto_id: item.producto_id,
            cantidad: item.cantidad,
            total: item.subtotal,
            tipo: item.tipo || 'producto',
            concepto: item.nombre
        }))
        const { error: fallbackError } = await supabase.from('Ventas').insert(fallbackVentas)
        return fallbackError || error
    }

    const handleCobrar = async () => {
        if (carrito.length === 0) return
        setCobrando(true)
        const itemsCobrados = [...carrito]

        if (isOnline) {
            const error = await insertarVentas(itemsCobrados)
            if (error) {
                console.error(error)
                mostrarToast('❌ No se pudo registrar. Ejecuta el SQL nuevo en Supabase.')
                setCobrando(false)
                return
            }

            for (const item of itemsCobrados) {
                if (!item.producto_id) continue
                await supabase.from('Inventario').update({ stock: item.stock_disponible - item.cantidad }).eq('id', item.producto_id)
            }
            mostrarToast('✨ Venta cobrada. Inventario actualizado.')
            setUltimoTicket({ fecha: new Date().toISOString(), items: itemsCobrados, total: totalCarrito, costoTotal: costoTotalCarrito, ganancia: gananciaCarrito })
        } else {
            guardarTicketOffline(itemsCobrados)
        }

        setCarrito([])
        cargarDatos()
        setCobrando(false)
    }

    const handleGuardarIngresoLibre = async (e: React.FormEvent) => {
        e.preventDefault()
        const monto = Number(montoLibre)
        if (!conceptoLibre.trim() || !monto || monto <= 0) return
        setGuardandoLibre(true)

        const itemLibre: ItemCarrito = {
            producto_id: null,
            nombre: conceptoLibre.trim(),
            concepto: conceptoLibre.trim(),
            cantidad: 1,
            precio: monto,
            costo_unitario: 0,
            subtotal: monto,
            costo_total: 0,
            ganancia: monto,
            stock_disponible: 0,
            tipo: tipoLibre,
            libre: true
        }

        if (isOnline) {
            const error = await insertarVentas([itemLibre])
            if (error) {
                console.error(error)
                mostrarToast('❌ Falta aplicar el SQL para ingresos libres en Supabase.')
                setGuardandoLibre(false)
                return
            }
            setUltimoTicket({ fecha: new Date().toISOString(), items: [itemLibre], total: monto, costoTotal: 0, ganancia: monto })
            mostrarToast('💖 Ingreso libre registrado.')
        } else {
            guardarTicketOffline([itemLibre], '💾 Ingreso libre guardado sin internet.')
        }

        setConceptoLibre('Propina')
        setMontoLibre('')
        setTipoLibre('propina')
        setOpenIngresoLibre(false)
        setGuardandoLibre(false)
        cargarDatos()
    }

    const handleEliminarVenta = async (venta: VentaRegistrada) => {
        if (venta.offline) {
            alert('Para cancelar una venta hecha sin internet, primero sincroniza el sistema.')
            return
        }

        if (!window.confirm(`¿Cancelar venta: "${nombreDeVenta(venta)}" por ${formatoMoneda(Number(venta.total))}?`)) return

        if (isOnline) {
            await supabase.from('Ventas').delete().eq('id', venta.id)
            if (venta.producto_id) {
                const productoReal = productos.find(p => p.id === venta.producto_id)
                if (productoReal) {
                    await supabase.from('Inventario').update({ stock: productoReal.stock + venta.cantidad }).eq('id', venta.producto_id)
                }
            }
            cargarDatos()
            mostrarToast('🗑️ Venta cancelada e inventario restaurado.')
        } else {
            alert('Necesitas conexión a internet para cancelar ventas en la base de datos central.')
        }
    }

    const copiarTicket = async () => {
        if (!ultimoTicket) return
        await navigator.clipboard.writeText(crearTextoTicket(ultimoTicket))
        mostrarToast('📋 Ticket copiado.')
    }

    const abrirWhatsApp = () => {
        if (!ultimoTicket) return
        const texto = encodeURIComponent(crearTextoTicket(ultimoTicket))
        window.open(`https://wa.me/?text=${texto}`, '_blank')
    }

    return (
        <div className="app-shell p-4 sm:p-6 max-w-7xl mx-auto space-y-6 relative overflow-hidden animate-in fade-in duration-500">
            <div className="flex flex-col gap-3 md:flex-row md:justify-between md:items-center">
                <Link href="/" className="inline-flex items-center gap-2 text-primary hover:text-primary/80 transition-colors font-black bg-white/70 hover:bg-white px-4 py-2.5 rounded-2xl w-fit shadow-sm border border-white/70">
                    <ArrowLeft size={18} /> Regresar al panel
                </Link>

                <div className="flex flex-wrap items-center gap-2">
                    {ventasPendientesCount > 0 && (
                        <div className="flex items-center gap-2 bg-amber-100 text-amber-700 px-3 py-1.5 rounded-xl text-sm font-black animate-pulse">
                            <CloudOff size={16} /> {ventasPendientesCount} tickets sin subir
                        </div>
                    )}
                    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm font-black ${isOnline ? 'bg-green-100 text-green-700' : 'bg-destructive/10 text-destructive'}`}>
                        {isOnline ? <><Wifi size={16} /> En línea</> : <><WifiOff size={16} /> Offline</>}
                    </div>
                </div>
            </div>

            <div className={`fixed bottom-6 right-6 z-50 transition-all duration-500 ease-out transform ${toast.visible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0 pointer-events-none'}`}>
                <div className="bg-primary text-white px-6 py-4 rounded-2xl shadow-xl font-medium flex items-center gap-3">
                    <CheckCircle2 size={20} /> {toast.mensaje}
                </div>
            </div>

            <section className="hero-card rounded-[2rem] p-6 sm:p-8 border border-white/70 shadow-sm">
                <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
                    <div>
                        <div className="inline-flex items-center gap-2 rounded-full bg-white/70 px-4 py-2 text-sm font-black text-primary shadow-sm mb-3"><Sparkles size={16} /> Punto de venta bonito</div>
                        <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-foreground">Ventas y tickets</h1>
                        <p className="text-muted-foreground mt-2 max-w-2xl">Cobra productos, registra propinas, descuenta inventario y genera tickets listos para WhatsApp.</p>
                    </div>
                    <Link href="/pedidos"><Button variant="secondary" className="rounded-2xl h-12 px-5 font-black bg-white/80 text-primary hover:bg-white">Ver pedidos y fiados</Button></Link>
                </div>
            </section>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <div className="lg:col-span-5 space-y-6">
                    <Card className="soft-card p-6 rounded-3xl">
                        <div className="flex items-start justify-between gap-3 mb-4">
                            <div>
                                <h2 className="text-xl font-black text-foreground">Añadir producto</h2>
                                <p className="text-sm text-muted-foreground mt-1">Busca un producto, elige cantidad y agrégalo al ticket.</p>
                            </div>
                            <ShoppingCart className="text-primary" size={24} />
                        </div>

                        <div className="relative mb-4">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-primary/50" size={18} />
                            <Input
                                placeholder="Escribe para buscar..."
                                value={busquedaPOS}
                                onChange={(e) => setBusquedaPOS(e.target.value)}
                                className="pl-10 h-12 rounded-2xl bg-secondary/30 border-transparent focus-visible:ring-primary/30"
                            />
                        </div>

                        <form onSubmit={handleAgregarAlCarrito} className="space-y-4">
                            <select
                                value={productoSeleccionadoId}
                                onChange={(e) => setProductoSeleccionadoId(e.target.value)}
                                className="w-full h-12 px-4 rounded-2xl border border-input bg-background text-sm outline-none focus:ring-2 focus:ring-primary/50 font-semibold"
                            >
                                <option value="">-- Seleccionar producto --</option>
                                {productosFiltradosParaSelect.map((p) => (
                                    <option key={p.id} value={p.id} disabled={p.stock <= 0}>
                                        {p.nombre} ({p.stock} pzs) - {formatoMoneda(p.precio_venta)}
                                    </option>
                                ))}
                            </select>

                            <div className="flex gap-4 items-end">
                                <div className="space-y-1.5 w-1/3">
                                    <label className="text-sm font-black text-muted-foreground ml-1">Cant.</label>
                                    <Input type="number" min="1" value={cantidad} onChange={(e) => setCantidad(e.target.value)} className="h-12 rounded-2xl text-center font-black" />
                                </div>
                                <Button type="submit" variant="secondary" className="h-12 w-2/3 rounded-2xl bg-secondary hover:bg-primary/20 text-primary transition-colors font-black" disabled={!productoSeleccionadoId}>
                                    + Al carrito
                                </Button>
                            </div>
                        </form>
                    </Card>

                    <Card className="soft-card p-6 rounded-3xl bg-gradient-to-br from-primary/10 to-white/90">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                            <div>
                                <h2 className="text-lg font-black text-primary flex items-center gap-2"><HandCoins size={20} /> Ingreso libre</h2>
                                <p className="text-sm text-muted-foreground mt-1">Para propinas, anticipos o ventas especiales.</p>
                            </div>
                            <Dialog open={openIngresoLibre} onOpenChange={setOpenIngresoLibre}>
                                <DialogTrigger asChild>
                                    <Button className="rounded-2xl h-12 px-5 font-black">+ Registrar monto</Button>
                                </DialogTrigger>
                                <DialogContent className="sm:max-w-[430px] rounded-3xl">
                                    <DialogHeader>
                                        <DialogTitle className="text-xl text-foreground">Registrar ingreso libre</DialogTitle>
                                        <DialogDescription>Este movimiento suma a ventas sin descontar inventario.</DialogDescription>
                                    </DialogHeader>
                                    <form onSubmit={handleGuardarIngresoLibre} className="space-y-4 pt-4">
                                        <div className="space-y-1.5"><label className="text-sm font-black">Concepto</label><Input value={conceptoLibre} onChange={(e) => setConceptoLibre(e.target.value)} required className="rounded-2xl h-12" /></div>
                                        <div className="space-y-1.5"><label className="text-sm font-black">Monto</label><Input type="number" min="1" step="0.01" value={montoLibre} onChange={(e) => setMontoLibre(e.target.value)} required className="rounded-2xl h-12" /></div>
                                        <div className="space-y-1.5">
                                            <label className="text-sm font-black">Tipo</label>
                                            <select value={tipoLibre} onChange={(e) => setTipoLibre(e.target.value)} className="w-full h-12 px-4 rounded-2xl border border-input bg-background text-sm outline-none focus:ring-2 focus:ring-primary/50 font-semibold">
                                                <option value="propina">Propina</option>
                                                <option value="libre">Ingreso libre</option>
                                                <option value="anticipo">Anticipo</option>
                                                <option value="extra">Extra</option>
                                            </select>
                                        </div>
                                        <Button type="submit" disabled={guardandoLibre} className="w-full rounded-2xl h-12 font-black">{guardandoLibre ? 'Guardando...' : 'Guardar ingreso'}</Button>
                                    </form>
                                </DialogContent>
                            </Dialog>
                        </div>
                    </Card>

                    <Card className="soft-card p-0 rounded-3xl overflow-hidden">
                        <div className="p-5 border-b border-border/50 flex justify-between items-center bg-white/50">
                            <div>
                                <h2 className="text-xl font-black text-foreground flex items-center gap-2"><ReceiptText className="text-primary" size={22} /> Ticket actual</h2>
                                <p className="text-xs text-muted-foreground">La ganancia se calcula con el precio costo del inventario.</p>
                            </div>
                            <span className="text-sm font-black text-muted-foreground">{carrito.length} items</span>
                        </div>

                        <div className="p-4 min-h-[220px] max-h-[320px] overflow-y-auto space-y-3">
                            {carrito.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center text-muted-foreground opacity-60 pt-8">
                                    <ShoppingCart size={42} className="mb-3 opacity-40" />
                                    <p className="text-sm font-bold">El carrito está vacío</p>
                                </div>
                            ) : (
                                carrito.map((item) => (
                                    <div key={`${item.producto_id}-${item.nombre}`} className="flex justify-between items-center p-3 bg-secondary/30 rounded-2xl">
                                        <div>
                                            <p className="font-black text-sm text-foreground">{item.nombre}</p>
                                            <p className="text-xs text-muted-foreground">{item.cantidad} x {formatoMoneda(item.precio)} · gana {formatoMoneda(item.ganancia)}</p>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <span className="font-black text-primary">{formatoMoneda(item.subtotal)}</span>
                                            <button onClick={() => quitarDelCarrito(item.producto_id, item.nombre)} className="text-destructive hover:bg-destructive/10 p-2 rounded-xl transition-all" aria-label="Quitar del carrito">
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>

                        <div className="p-5 bg-primary/5 border-t border-border/50 space-y-4">
                            <div className="grid grid-cols-2 gap-3">
                                <div className="rounded-2xl bg-white/70 p-3"><p className="text-xs font-black text-muted-foreground">Costo</p><p className="font-black text-foreground">{formatoMoneda(costoTotalCarrito)}</p></div>
                                <div className="rounded-2xl bg-green-50 p-3"><p className="text-xs font-black text-muted-foreground">Ganancia</p><p className="font-black text-green-600">{formatoMoneda(gananciaCarrito)}</p></div>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-sm font-black text-muted-foreground">Total general:</span>
                                <span className="text-3xl font-black text-primary">{formatoMoneda(totalCarrito)}</span>
                            </div>
                            <Button onClick={handleCobrar} disabled={carrito.length === 0 || cobrando} className={`w-full h-14 rounded-2xl text-lg font-black shadow-lg ${isOnline ? 'shadow-primary/10' : 'bg-amber-500 hover:bg-amber-600 text-white shadow-amber-500/20'}`}>
                                {cobrando ? 'Procesando...' : isOnline ? '💳 Cobrar ticket' : '💾 Guardar offline'}
                            </Button>
                        </div>
                    </Card>

                    {ultimoTicket && (
                        <Card className="soft-card p-5 rounded-3xl border-primary/20 bg-primary/5">
                            <h3 className="font-black text-foreground flex items-center gap-2"><MessageCircle className="text-primary" size={20} /> Último ticket listo</h3>
                            <p className="text-sm text-muted-foreground mt-1">Cópialo o mándalo por WhatsApp al cliente.</p>
                            <div className="mt-4 rounded-2xl bg-white/80 p-4 text-sm whitespace-pre-line border border-white">
                                {crearTextoTicket(ultimoTicket)}
                            </div>
                            <div className="grid grid-cols-2 gap-3 mt-4">
                                <Button variant="secondary" onClick={copiarTicket} className="rounded-2xl font-black"><Copy size={16} /> Copiar</Button>
                                <Button onClick={abrirWhatsApp} className="rounded-2xl font-black"><MessageCircle size={16} /> WhatsApp</Button>
                            </div>
                        </Card>
                    )}
                </div>

                <div className="lg:col-span-7 space-y-6">
                    <Card className="soft-card p-5 rounded-3xl">
                        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
                            <div>
                                <h2 className="text-xl font-black text-foreground flex items-center gap-2"><ListChecks className="text-primary" size={22} /> Historial de ventas</h2>
                                <p className="text-sm text-muted-foreground mt-1">Desde hoy hasta todas las ventas de todos los tiempos.</p>
                            </div>
                            <div className="flex items-center gap-2">
                                <CalendarDays size={18} className="text-primary/70 hidden sm:block" />
                                <select value={filtroHistorial} onChange={(e) => setFiltroHistorial(e.target.value as FiltroHistorial)} className="w-full md:w-48 h-11 px-4 rounded-2xl border border-input bg-background text-sm outline-none focus:ring-2 focus:ring-primary/50 font-black">
                                    <option value="hoy">Hoy</option>
                                    <option value="semana">Últimos 7 días</option>
                                    <option value="mes">Este mes</option>
                                    <option value="todo">Todos los tiempos</option>
                                </select>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 mt-5">
                            <div className="rounded-2xl bg-primary/10 p-4"><p className="text-xs font-black text-muted-foreground uppercase">Vendido</p><p className="text-lg font-black text-primary">{formatoMoneda(resumenHistorial.total)}</p></div>
                            <div className="rounded-2xl bg-red-50 p-4"><p className="text-xs font-black text-muted-foreground uppercase">Costo</p><p className="text-lg font-black text-destructive">{formatoMoneda(resumenHistorial.costo)}</p></div>
                            <div className="rounded-2xl bg-green-50 p-4"><p className="text-xs font-black text-muted-foreground uppercase">Ganancia</p><p className="text-lg font-black text-green-600">{formatoMoneda(resumenHistorial.ganancia)}</p></div>
                            <div className="rounded-2xl bg-amber-50 p-4"><p className="text-xs font-black text-muted-foreground uppercase">Libres</p><p className="text-lg font-black text-amber-600">{resumenHistorial.ingresosLibres}</p></div>
                        </div>
                    </Card>

                    <Card className="soft-card p-0 rounded-3xl overflow-hidden">
                        {loading ? (
                            <div className="animate-pulse space-y-4 p-6"><div className="h-12 bg-secondary/50 rounded-xl"></div></div>
                        ) : (
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader className="bg-secondary/30">
                                        <TableRow>
                                            <TableHead className="pl-4">Fecha</TableHead>
                                            <TableHead>Concepto</TableHead>
                                            <TableHead className="text-right">Cant</TableHead>
                                            <TableHead className="text-right">Total</TableHead>
                                            <TableHead className="text-right">Ganancia</TableHead>
                                            <TableHead className="text-center">Estado</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {ventas.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={6} className="text-center h-32 text-muted-foreground">No hay ventas en este filtro.</TableCell>
                                            </TableRow>
                                        ) : (
                                            ventas.map((v) => (
                                                <TableRow key={v.id} className="transition-colors hover:bg-secondary/10">
                                                    <TableCell className="text-sm text-muted-foreground pl-4 whitespace-nowrap">
                                                        {new Date(v.created_at).toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })} · {new Date(v.created_at).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
                                                    </TableCell>
                                                    <TableCell className="font-bold text-foreground">
                                                        <div className="flex flex-col">
                                                            <span>{nombreDeVenta(v)}</span>
                                                            {!v.producto_id && <span className="text-xs text-amber-600 font-black">Ingreso libre</span>}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-right font-medium">{v.producto_id ? `${v.cantidad} pzs` : '-'}</TableCell>
                                                    <TableCell className="text-right font-black text-primary">{formatoMoneda(Number(v.total))}</TableCell>
                                                    <TableCell className="text-right font-black text-green-600">{formatoMoneda(Number(v.ganancia ?? (Number(v.total) - Number(v.costo_total || 0))))}</TableCell>
                                                    <TableCell className="text-center">
                                                        {v.offline ? (
                                                            <span className="text-xs font-black text-amber-600 bg-amber-100 px-2 py-1 rounded-lg flex items-center justify-center gap-1 w-fit mx-auto">
                                                                <CloudOff size={12} /> Pendiente
                                                            </span>
                                                        ) : (
                                                            <Button variant="ghost" size="sm" onClick={() => handleEliminarVenta(v)} className="h-9 w-9 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-xl">
                                                                <Trash2 size={16} />
                                                            </Button>
                                                        )}
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        )}
                    </Card>
                </div>
            </div>
        </div>
    )
}
