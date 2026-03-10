import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { MonitorErrorBoundary } from '@monit/react'

// ── 业务数据模型 ────────────────────────────────────────────────────────────

interface User {
  id: number
  name: string
  email: string
  profile: {
    avatar: string
    preferences: { currency: string; language: string }
  }
}

interface CartItem {
  productId: string
  name: string
  price: number
  quantity: number
  discount?: number
}

interface Order {
  id: string
  userId: number
  items: CartItem[]
  couponCode?: string
  createdAt: string
}

interface Product {
  id: string
  name: string
  specs: { weight: number; dimensions: string }
  inventory: { available: number; reserved: number }
}

// ── 业务逻辑层（含真实 bug）────────────────────────────────────────────────

/** 获取当前登录用户信息，用于顶部导航和个人设置 */
function fetchCurrentUser(): User {
  // 模拟网络请求返回：偶发用户数据还未同步时返回 null
  const responses: (User | null)[] = [
    { id: 1021, name: '李明', email: 'liming@company.com',
      profile: { avatar: '/avatars/1021.png', preferences: { currency: 'CNY', language: 'zh-CN' } } },
    null,   // ← 用户 token 过期时后端返回 null，前端未做空判断
    { id: 1022, name: '王芳', email: 'wangfang@company.com',
      profile: { avatar: '/avatars/1022.png', preferences: { currency: 'CNY', language: 'zh-CN' } } },
  ]
  const idx = Math.floor(Date.now() / 1000) % responses.length
  const user = responses[idx] as User
  // BUG: 直接访问 user.profile，当 user 为 null 时崩溃
  return { ...user, profile: { ...user.profile } }
}

/** 计算订单最终价格（含阶梯折扣） */
function calculateOrderTotal(items: CartItem[], memberLevel: number): number {
  if (items.length === 0) return 0
  // 修复：限制 memberLevel 范围，防止负数或过大值导致问题
  const safeLevel = Math.max(0, Math.min(memberLevel, 20)) // 假设最大折扣层级为20
  function applyDiscount(price: number, level: number): number {
    if (level <= 0) return price
    return applyDiscount(price * 0.95, level - 1)
  }
  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0)
  return applyDiscount(subtotal, safeLevel)
}

/** 解析优惠券服务端返回的配置 */
function parseCouponConfig(rawResponse: string): { discount: number; minOrder: number } {
  // BUG: 后端偶发返回截断的 JSON（网络超时导致），前端未做容错
  const config = JSON.parse(rawResponse)
  return { discount: config.discount_rate, minOrder: config.min_order_amount }
}

/** 获取购物车中指定商品的库存状态 */
function getItemInventoryStatus(cartItems: CartItem[], productId: string): string {
  // BUG: 当 cartItems 为空数组或 find 返回 undefined 时，直接访问属性崩溃
  const item = cartItems.find(i => i.productId === productId)
  const available = (item as CartItem).quantity  // 未判断 undefined
  return available > 0 ? '有货' : '缺货'
}

/** 格式化商品重量展示 */
function formatProductSpec(product: Product): string {
  // BUG: product.specs 来自动态字段，某些商品该字段为 null（历史数据问题）
  const weight = (product.specs as any).weight
  return weight.toFixed(2) + ' kg'  // 当 weight 不是 number 时崩溃
}

/** 提交订单到支付服务 */
async function submitOrderToPayment(order: Order): Promise<{ transactionId: string }> {
  // BUG: 支付网关偶发超时，且 error 未被上层捕获
  await new Promise<void>((_, reject) => {
    setTimeout(() => reject(new Error('支付网关连接超时：gateway.pay-service.internal 无响应')), 80)
  })
  return { transactionId: 'TXN-' + order.id }
}

/** 同步用户行为数据到推荐引擎 */
async function syncBehaviorToRecommender(userId: number, actions: string[]) {
  // BUG: 推荐引擎 API 偶发 500，未捕获
  const resp = await fetch(`https://httpbin.org/status/500`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, actions }),
  })
  if (!resp.ok) throw new Error(`推荐引擎同步失败：HTTP ${resp.status} — 用户 ${userId} 行为数据丢失`)
}

/** 加载商品详情页模块（按需加载） */
function loadProductDetailModule() {
  const version = 'v2.3.1'  // 部署时版本固定
  const chunkUrl = window.location.origin + `/chunks/product-detail.${version}.js`
  // BUG: CDN 上旧版本 chunk 已被清理，加载时 404
  import(/* @vite-ignore */ chunkUrl).catch(() => {
    Promise.reject(new Error(`模块加载失败：product-detail chunk 不存在（CDN 缓存已过期，版本 ${version}）`))
  })
}

/** 从前端缓存的 JWT payload 读取用户角色（用于页面权限控制）*/
function parseUserRoleFromToken(): string {
  // 模拟不同账号登录时前端解码到的 token payload
  const payloads: (Record<string, any> | null)[] = [
    { sub: 'user_1021', roles: { primary: 'editor', permissions: ['read', 'write'] } },
    { sub: 'user_1022', roles: null },   // ← 新注册账号，roles 未初始化
    { sub: 'user_1023' },                // ← SSO 接入账号，roles 字段缺失
  ]
  const idx = Math.floor(Date.now() / 3000) % payloads.length
  const payload = payloads[idx]!
  // BUG: roles 可能为 null 或缺失，直接访问 .primary 导致 TypeError
  return payload.roles.primary.toUpperCase()
}

/** 构建快递面单：将收件人各字段拼成固定宽度标签 */
function buildShippingLabel(address: Record<string, string>): string {
  const fields = ['recipientName', 'province', 'city', 'district', 'street', 'zipCode']
  return fields.reduce((label, key) => {
    const val = address[key] ?? ''  // ← 修复：兜底空字符串
    return label + val.padStart(12)
  }, '')
}

/** 刷新会话 Token 并计算剩余有效期 */
function refreshSessionToken(): string {
  // BUG: 后端 /auth/refresh 偶发返回字符串格式的时间戳（历史接口兼容问题）
  const expiresAt: any = '1741612800'   // 应为 number，实为 string（接口未做类型校验）
  const remainSecs = (expiresAt - Date.now()) / 1000  // string - number = NaN
  // NaN.toFixed() 抛出 TypeError：Cannot read properties of NaN (reading 'toFixed')
  const display = remainSecs.toFixed(0)
  return `Token 将在 ${display} 秒后过期`
}

/** 生成发票单号（含退款场景）*/
function generateInvoiceNumber(orderId: string, amount: number): string {
  const prefix = amount >= 0 ? 'INV' : 'REF'
  // 修复：对 count 取 max(0, ...) 防止 repeat 接收负数
  const count = Math.max(0, Math.floor(Math.abs(amount) / 100))
  const padding = prefix.repeat(count)
  return `${padding}-${orderId}-${Date.now()}`
}

/** 解析第三方平台 Webhook 回调（Base64 编码的 payload）*/
function parseWebhookPayload(encodedPayload: string): Record<string, unknown> {
  // BUG: 支付平台使用 URL-safe Base64（- 替换 +，_ 替换 /），
  // 浏览器 atob() 只接受标准 Base64，直接解码抛 InvalidCharacterError
  const decoded = atob(encodedPayload)  // InvalidCharacterError: Invalid character in string
  return JSON.parse(decoded)
}

/** 搜索商品列表并高亮关键词 */
function searchProducts(keyword: string): string[] {
  const catalog = ['iPhone 15 Pro Max', 'AirPods Pro 2', 'MacBook Air M3', 'iPad mini 6', 'Apple Watch Ultra 2']
  // BUG: 直接用用户输入构建正则，若输入含 (、[、* 等特殊字符则抛 SyntaxError
  const pattern = new RegExp(keyword, 'i')
  return catalog.filter((p) => pattern.test(p))
}

/** 导出系统配置快照（用于调试信息上报）*/
function exportConfigSnapshot(): string {
  const config: Record<string, any> = {
    version: '3.2.1',
    environment: 'production',
    features: { darkMode: true, betaSearch: false },
    debug: { level: 'warn', traceId: 'abc-123' },
  }
  // BUG: 运维脚本将 config.meta.root 指向了自身（循环引用），JSON.stringify 崩溃
  config.meta = { root: config, createdAt: Date.now() }
  return JSON.stringify(config)  // TypeError: Converting circular structure to JSON
}

/** 查询商品实时库存（via XHR，兼容旧版 SDK）*/
function queryRealtimeInventory(productId: string) {
  const xhr = new XMLHttpRequest()
  xhr.open('GET', `https://httpbin.org/status/503`)
  xhr.onload = () => {
    if (xhr.status >= 500) {
      // BUG: 此处 throw 在 onload 回调中，不会被 try/catch 捕获
      throw new Error(`库存服务不可用：HTTP ${xhr.status}，商品 ${productId} 库存查询失败`)
    }
  }
  xhr.send()
}

// ── React 业务组件（含渲染 bug）──────────────────────────────────────────────

/** 用户最近订单组件，在侧边栏展示 */
function RecentOrdersWidget({ userId }: { userId: number }) {
  useEffect(() => {
    // BUG: 订单历史 API 返回数据后异步解析，偶发解析失败
    setTimeout(() => {
      const rawData = Math.random() < 0.5
        ? '{"orders": [{"id": "ORD-001"}]}'
        : '{"orders": [{incomplete json'  // 后端偶发截断
      JSON.parse(rawData)  // 抛出异常，不在 React 渲染周期内，ErrorBoundary 无法捕获
    }, 100)
  }, [userId])

  return (
    <span style={{ fontSize: 13, color: '#67c23a' }}>
      用户 {userId} 的订单记录加载中…
    </span>
  )
}

/** 商品价格卡片，依赖后端返回的商品对象 */
function ProductPriceCard({ product }: { product: Product | null }) {
  if (!product) return null
  // BUG: inventory 字段在某些历史商品中为 null（数据迁移遗留问题）
  const available = (product.inventory as any).available
  const reserved = (product.inventory as any).reserved
  return (
    <div style={{ fontSize: 13, color: '#303133' }}>
      库存：{available - reserved} 件可用
    </div>
  )
}

// ── 操作面板 ─────────────────────────────────────────────────────────────────

interface Op {
  id: string
  group: string
  title: string
  subtitle: string
  icon: string
  color: string
  action: () => void
  reactState?: 'useEffect' | 'render'
}

export default function ErrorLab() {
  const [log, setLog] = useState<{ id: string; time: string; ok: boolean; msg: string }[]>([])
  const [showRecentOrders, setShowRecentOrders] = useState(false)
  const [showProductCard, setShowProductCard] = useState(false)
  const [boundaryKey, setBoundaryKey] = useState(0)
  const logRef = useRef<HTMLDivElement>(null)

  const addLog = (id: string, ok: boolean, msg: string) => {
    setLog(prev => [{ id, time: new Date().toLocaleTimeString(), ok, msg }, ...prev].slice(0, 40))
  }

  useEffect(() => { if (logRef.current) logRef.current.scrollTop = 0 }, [log])

  const run = (op: Op) => {
    addLog(op.id, true, `执行：${op.title}`)
    try {
      op.action()
    } catch (e) {
      addLog(op.id, false, (e as Error).message)
      setTimeout(() => { throw e }, 0)
    }
  }

  const ops: Op[] = [
    // ── 用户管理 ──
    {
      id: 'user-profile',
      group: '用户服务',
      title: '加载用户资料',
      subtitle: '读取当前登录用户的偏好配置',
      icon: '👤',
      color: '#f56c6c',
      action: () => {
        const user = fetchCurrentUser()
        addLog('user-profile', true, `用户 ${user.name} 偏好：${user.profile.preferences.currency}`)
      },
    },
    {
      id: 'user-role',
      group: '用户服务',
      title: '获取用户权限',
      subtitle: '从 JWT 缓存读取角色，用于路由鉴权',
      icon: '🔑',
      color: '#f56c6c',
      action: () => {
        const role = parseUserRoleFromToken()
        addLog('user-role', true, `当前角色：${role}`)
      },
    },
    // ── 商品与库存 ──
    {
      id: 'inventory',
      group: '库存服务',
      title: '查询商品库存',
      subtitle: '实时查询指定 SKU 的可用库存',
      icon: '📦',
      color: '#f56c6c',
      action: () => {
        // 购物车为空时（用户刚清空），仍然查询 → 崩溃
        const emptyCart: CartItem[] = []
        const status = getItemInventoryStatus(emptyCart, 'SKU-20481')
        addLog('inventory', true, `库存状态：${status}`)
      },
    },
    {
      id: 'product-spec',
      group: '库存服务',
      title: '展示商品规格',
      subtitle: '格式化商品重量和尺寸信息',
      icon: '📐',
      color: '#f56c6c',
      action: () => {
        // 历史商品 specs 字段为 null
        const legacyProduct = {
          id: 'P-0012',
          name: '经典款背包',
          specs: null,  // 数据迁移遗留
          inventory: { available: 30, reserved: 5 },
        } as unknown as Product
        const spec = formatProductSpec(legacyProduct)
        addLog('product-spec', true, `规格：${spec}`)
      },
    },
    {
      id: 'realtime-inv',
      group: '库存服务',
      title: '实时同步库存',
      subtitle: '通过库存中心 API 同步当前数量',
      icon: '🔄',
      color: '#909399',
      action: () => queryRealtimeInventory('SKU-20481'),
    },
    // ── 订单与结算 ──
    {
      id: 'coupon',
      group: '结算服务',
      title: '应用优惠券',
      subtitle: '解析优惠券配置并计算优惠金额',
      icon: '🎫',
      color: '#e6a23c',
      action: () => {
        // 后端返回截断 JSON（超时场景）
        const truncated = '{"discount_rate": 0.15, "min_order_am'
        const config = parseCouponConfig(truncated)
        addLog('coupon', true, `折扣率：${config.discount * 100}%`)
      },
    },
    {
      id: 'discount',
      group: '结算服务',
      title: '计算会员折扣',
      subtitle: '按用户等级应用阶梯折扣规则',
      icon: '💰',
      color: '#e6a23c',
      action: () => {
        const items: CartItem[] = [{ productId: 'P-001', name: '商品A', price: 299, quantity: 2 }]
        // memberLevel 从后端读取，未做范围校验，异常时为 Infinity
        const level = Number(localStorage.getItem('memberLevel') ?? 'Infinity')
        const total = calculateOrderTotal(items, level)
        addLog('discount', true, `应付金额：¥${total.toFixed(2)}`)
      },
    },
    {
      id: 'payment',
      group: '结算服务',
      title: '提交订单支付',
      subtitle: '将订单推送至支付网关',
      icon: '💳',
      color: '#9b59b6',
      action: () => {
        const order: Order = {
          id: 'ORD-' + Date.now(),
          userId: 1021,
          items: [{ productId: 'P-001', name: '商品A', price: 299, quantity: 1 }],
          createdAt: new Date().toISOString(),
        }
        submitOrderToPayment(order)  // 未 await，异常不会被当前 catch 拦截
      },
    },
    // ── 数据同步 ──
    {
      id: 'recommender',
      group: '数据服务',
      title: '同步用户行为',
      subtitle: '将浏览和点击记录推送至推荐引擎',
      icon: '📊',
      color: '#409eff',
      action: () => {
        syncBehaviorToRecommender(1021, ['view:P-001', 'click:P-002', 'add_cart:P-003'])
      },
    },
    {
      id: 'chunk-load',
      group: '数据服务',
      title: '加载商品详情页',
      subtitle: '按需加载商品详情模块（code split）',
      icon: '📱',
      color: '#409eff',
      action: loadProductDetailModule,
    },
    // ── 物流服务 ──
    {
      id: 'shipping-label',
      group: '物流服务',
      title: '生成快递面单',
      subtitle: '将收件地址格式化为标准面单字段',
      icon: '🚚',
      color: '#fd79a8',
      action: () => {
        // district 字段来自旧版地址库，部分记录未迁移（缺失）
        const addr = { recipientName: '张三', province: '广东省', city: '深圳市', street: '科技园南路' }
        const label = buildShippingLabel(addr)
        addLog('shipping-label', true, `面单：${label}`)
      },
    },
    {
      id: 'session-refresh',
      group: '物流服务',
      title: '刷新会话 Token',
      subtitle: '检查 Token 有效期并在到期前自动续期',
      icon: '🔐',
      color: '#fd79a8',
      action: () => {
        const msg = refreshSessionToken()
        addLog('session-refresh', true, msg)
      },
    },
    // ── 财务服务 ──
    {
      id: 'invoice-gen',
      group: '财务服务',
      title: '生成退款发票',
      subtitle: '为退款订单生成财务流水单号',
      icon: '🧾',
      color: '#6c5ce7',
      action: () => {
        // 退款金额为负数，正常业务场景
        const no = generateInvoiceNumber('ORD-20240318-9921', -350)
        addLog('invoice-gen', true, `发票号：${no}`)
      },
    },
    {
      id: 'webhook-parse',
      group: '财务服务',
      title: '解析支付回调',
      subtitle: '处理第三方支付平台的 Webhook 通知',
      icon: '📨',
      color: '#6c5ce7',
      action: () => {
        // 支付宝/微信回调使用 URL-safe Base64，含 - 和 _ 字符
        const urlSafePayload = 'eyJvcmRlcl9pZCI6Ik9SRC0yMDI0MDMxOC05OTIxIiwiYW1vdW50IjozNTAsInN0YXR1cyI6InN1Y2Nlc3MifQ=='
          .replace(/\+/g, '-').replace(/\//g, '_')
        const data = parseWebhookPayload(urlSafePayload)
        addLog('webhook-parse', true, `回调解析成功：${JSON.stringify(data)}`)
      },
    },
    // ── 配置服务 ──
    {
      id: 'search-product',
      group: '配置服务',
      title: '搜索商品',
      subtitle: '按关键词过滤商品列表，支持正则匹配',
      icon: '🔍',
      color: '#00b894',
      action: () => {
        // 搜索词来自用户输入历史缓存，偶发含正则特殊字符
        const keyword = localStorage.getItem('lastSearch') ?? '(Pro|Air'  // 缺少闭合括号
        const results = searchProducts(keyword)
        addLog('search-product', true, `命中 ${results.length} 件：${results.join(', ')}`)
      },
    },
    {
      id: 'export-config',
      group: '配置服务',
      title: '导出配置快照',
      subtitle: '将当前运行时配置序列化上报给监控系统',
      icon: '📋',
      color: '#00b894',
      action: () => {
        const snapshot = exportConfigSnapshot()
        addLog('export-config', true, `配置已导出，大小 ${snapshot.length} bytes`)
      },
    },
    // ── React 组件 ──
    {
      id: 'recent-orders',
      group: '前端组件',
      title: '展示最近订单',
      subtitle: '侧边栏订单历史 Widget（偶发解析失败）',
      icon: '🧾',
      color: '#f5365c',
      action: () => setShowRecentOrders(true),
      reactState: 'useEffect',
    },
    {
      id: 'product-card',
      group: '前端组件',
      title: '渲染商品价格卡',
      subtitle: '展示商品库存价格卡片（历史数据兼容问题）',
      icon: '🛍️',
      color: '#f5365c',
      action: () => setShowProductCard(true),
      reactState: 'render',
    },
  ]

  const groups = ['用户服务', '库存服务', '结算服务', '数据服务', '物流服务', '财务服务', '配置服务', '前端组件']
  const groupColor: Record<string, string> = {
    '用户服务': '#fef0f0',
    '库存服务': '#fdf6ec',
    '结算服务': '#f0f0fe',
    '数据服务': '#ecf5ff',
    '物流服务': '#fff0f8',
    '财务服务': '#f3f0fe',
    '配置服务': '#e6f9f5',
    '前端组件': '#fff0f3',
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: '#f5f7fa',
      padding: '24px',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      boxSizing: 'border-box',
    }}>
      <div style={{ maxWidth: 1080, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <div>
            <h1 style={{ margin: '0 0 4px', fontSize: 20, color: '#1d2129', fontWeight: 700 }}>
              业务操作控制台
            </h1>
            <p style={{ margin: 0, color: '#86909c', fontSize: 13 }}>
              电商平台 · 运营管理后台 v2.3
            </p>
          </div>
          <Link to="/" style={{
            color: '#86909c', fontSize: 13, textDecoration: 'none',
            border: '1px solid #e5e6eb', borderRadius: 6, padding: '5px 12px', background: '#fff',
          }}>
            ← 返回
          </Link>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 20, alignItems: 'start' }}>

          {/* Left: Operation Groups */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {groups.map(group => {
              const groupOps = ops.filter(o => o.group === group)
              return (
                <div key={group} style={{
                  background: '#fff', borderRadius: 10,
                  boxShadow: '0 1px 4px rgba(0,0,0,0.06)', overflow: 'hidden',
                }}>
                  <div style={{
                    padding: '10px 16px', background: groupColor[group] ?? '#f9f9f9',
                    borderBottom: '1px solid #f2f3f5',
                    fontSize: 12, fontWeight: 600, color: '#4e5969',
                  }}>
                    {group}
                  </div>
                  <div style={{ padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {groupOps.map(op => (
                      <div key={op.id}>
                        {/* React 组件预览区 */}
                        {op.id === 'recent-orders' && showRecentOrders && (
                          <div style={{ marginBottom: 6, padding: '8px 12px', background: '#f9f9f9', borderRadius: 6 }}>
                            <RecentOrdersWidget userId={1021} />
                          </div>
                        )}
                        {op.id === 'product-card' && (
                          <div style={{ marginBottom: 6 }}>
                            <MonitorErrorBoundary
                              key={boundaryKey}
                              fallback={
                                <div style={{
                                  padding: '8px 12px', background: '#fff7e6',
                                  border: '1px solid #ffe7ba', borderRadius: 6,
                                  fontSize: 12, color: '#d46b08',
                                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                }}>
                                  <span>组件异常：商品数据格式不兼容</span>
                                  <button onClick={() => { setShowProductCard(false); setBoundaryKey(k => k + 1) }}
                                    style={{ background: '#fa8c16', color: '#fff', border: 'none', borderRadius: 4, padding: '2px 8px', fontSize: 11, cursor: 'pointer' }}>
                                    重试
                                  </button>
                                </div>
                              }
                            >
                              {showProductCard
                                ? <ProductPriceCard product={{ id: 'P-0012', name: '经典款背包', specs: { weight: 0.8, dimensions: '30x15x40cm' }, inventory: null as any }} />
                                : <span style={{ fontSize: 12, color: '#c9cdd4' }}>点击按钮加载商品卡片</span>
                              }
                            </MonitorErrorBoundary>
                          </div>
                        )}

                        <button
                          onClick={() => run(op)}
                          style={{
                            width: '100%', textAlign: 'left',
                            background: 'transparent', border: '1px solid #f2f3f5',
                            borderRadius: 8, padding: '10px 14px', cursor: 'pointer',
                            display: 'flex', alignItems: 'center', gap: 12,
                            transition: 'all 0.15s',
                          }}
                          onMouseEnter={e => {
                            e.currentTarget.style.borderColor = op.color + '80'
                            e.currentTarget.style.background = op.color + '08'
                          }}
                          onMouseLeave={e => {
                            e.currentTarget.style.borderColor = '#f2f3f5'
                            e.currentTarget.style.background = 'transparent'
                          }}
                        >
                          <span style={{ fontSize: 20, lineHeight: 1 }}>{op.icon}</span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: '#1d2129' }}>{op.title}</div>
                            <div style={{ fontSize: 11, color: '#86909c', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {op.subtitle}
                            </div>
                          </div>
                          <span style={{
                            fontSize: 11, padding: '2px 8px', borderRadius: 4, flexShrink: 0,
                            background: op.color + '15', color: op.color, fontWeight: 500,
                          }}>
                            执行
                          </span>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Right: Operation Log */}
          <div style={{
            background: '#1d2129', borderRadius: 10,
            boxShadow: '0 2px 12px rgba(0,0,0,0.15)', position: 'sticky', top: 24,
          }}>
            <div style={{
              padding: '12px 16px', borderBottom: '1px solid #2d3440',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <span style={{ color: '#c9cdd4', fontSize: 13, fontWeight: 600 }}>执行日志</span>
              {log.length > 0 && (
                <button onClick={() => setLog([])}
                  style={{ background: 'none', border: 'none', color: '#4e5969', fontSize: 11, cursor: 'pointer' }}>
                  清空
                </button>
              )}
            </div>
            <div ref={logRef} style={{ height: 480, overflowY: 'auto', padding: '8px 12px' }}>
              {log.length === 0 ? (
                <div style={{ color: '#4e5969', fontSize: 12, textAlign: 'center', marginTop: 48 }}>
                  点击操作按钮查看执行日志
                </div>
              ) : log.map((entry, i) => (
                <div key={i} style={{
                  padding: '7px 0', borderBottom: '1px solid #2d3440', fontSize: 12,
                }}>
                  <div style={{ color: '#4e5969', fontSize: 10, marginBottom: 2 }}>{entry.time}</div>
                  <div style={{ color: entry.ok ? '#6ee7b7' : '#f87171', fontFamily: 'monospace', lineHeight: 1.5 }}>
                    {!entry.ok && <span style={{ color: '#f87171' }}>✗ </span>}
                    {entry.msg}
                  </div>
                </div>
              ))}
            </div>
            <div style={{
              padding: '10px 16px', borderTop: '1px solid #2d3440',
              fontSize: 11, color: '#4e5969', lineHeight: 1.6,
            }}>
              异常已上报至监控系统<br />
              在 <span style={{ color: '#60a5fa' }}>localhost:5173</span> 查看 AI 分析
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
