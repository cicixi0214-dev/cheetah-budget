# Centsnap — Backend API 文档

## 现有端点
- `POST /mvp-api/auth/request-code` — 请求验证码
- `POST /mvp-api/auth/verify-code` — 验证并登录
- `GET  /mvp-api/auth/me` — 当前用户信息
- `POST /mvp-api/auth/logout` — 登出

## 新增端点（云同步）

### `POST /mvp-api/data/sync`
**用途**: Premium 用户将本地数据同步到云端。
**请求头**: `Authorization: Bearer <token>`
**请求体**:
```json
{
  "data": "<localStorage 中的 sbh3_data 完整 JSON 字符串>"
}
```
**响应**:
```json
{ "ok": true }
```
**错误**:
```json
{ "ok": false, "error": "未登录/非 Premium/数据格式错误" }
```

### `GET /mvp-api/data/load`
**用途**: Premium 用户从云端拉取数据。
**请求头**: `Authorization: Bearer <token>`
**响应**:
```json
{ "ok": true, "data": "<之前同步的 sbh3_data JSON 字符串>" }
```
**错误**:
```json
{ "ok": false, "error": "无数据/未登录/非 Premium" }
```

## App Store Connect 需要创建的商品

| 商品 ID | 类型 | 价格 |
|---------|------|------|
| `com.royhug.centsnap.premium.monthly` | 自动续期订阅 | $4.99/月 |
| `com.royhug.centsnap.premium.yearly` | 自动续期订阅 | $39.99/年 |
| `com.royhug.centsnap.premium.lifetime` | 一次性购买 | $79.99 |

## 定价策略

| 层级 | 价格 | 功能 |
|------|------|------|
| Free | $0 | 基础记账（本地存）、每月预算追踪、支出分类、自定义类别 |
| Premium | $4.99/月 or $39.99/年 | 高级图表分析、云端同步、多设备数据恢复、资产管理 |
| Lifetime | $79.99 | Premium 所有功能，永久有效 |

## 提醒：提交前检查
1. [ ] App Store Connect 将定价从 $4.99 改为 Free（免费下载）
2. [ ] App Store Connect 创建三个 IAP 商品（monthly/yearly/lifetime）
3. [ ] StoreKitManager.swift 中的 product ID 与 App Store Connect 一致
4. [ ] 后端部署 data/sync 和 data/load 端点
5. [ ] 真机测试：订阅流程、恢复订阅、云同步
