# Cambios agregados a la app de ventas

## Archivos principales modificados

- `app/page.tsx`
- `app/ventas/page.tsx`
- `app/gastos/page.tsx`
- `app/inventario/page.tsx`
- `app/pedidos/page.tsx`
- `app/globals.css`
- `lib/sync.ts`
- `supabase-mejoras.sql`

## Nuevas funciones importantes

### 1. Corte del día
En el panel principal ahora aparece una tarjeta de **Corte del día** con:

- ventas del día
- gastos del día
- ingresos libres / propinas
- productos vendidos
- movimientos registrados
- ganancia real del día

También tiene botón **Cerrar día** para guardar el corte en Supabase.

### 2. Ganancia real por producto
Las ventas ahora guardan:

- total vendido
- costo total del producto
- ganancia real

La ganancia se calcula usando `precio_costo` del inventario.

### 3. Inventario automático
Al cobrar un ticket:

- se guarda la venta
- se descuenta el stock automáticamente
- si cancelas una venta de producto, se restaura el stock
- también funciona con ventas offline y sincronización

### 4. Clientes y pedidos
Se agregó la nueva sección:

`/pedidos`

Sirve para guardar:

- clientes
- teléfono / WhatsApp
- detalle del pedido
- fecha de entrega
- notas
- estado del pedido

### 5. Fiados y pagos pendientes
En pedidos puedes guardar:

- total del pedido
- anticipo
- saldo pendiente
- estado de pago: pendiente, parcial o pagado

La app muestra cuánto le deben en el panel principal y en la página de pedidos.

### 6. Ticket para WhatsApp
Después de cobrar una venta se genera un ticket bonito que puedes:

- copiar
- mandar por WhatsApp

También los pedidos tienen ticket para WhatsApp con total, anticipo y saldo restante.

### 7. Diseño más bonito
Se mejoró el estilo general con:

- tarjetas tipo glass / pastel
- hero sections más bonitas
- mejor diseño en celular
- métricas más claras
- botones rápidos
- navegación a pedidos y fiados

## Importante antes de probar

Debes ejecutar el archivo:

`supabase-mejoras.sql`

en:

Supabase → SQL Editor → New Query → Run

Sin eso no funcionarán las tablas nuevas de:

- `Clientes`
- `Pedidos`
- `CortesDiarios`

ni las columnas nuevas de ganancia real en `Ventas`.
