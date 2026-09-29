# KestrelStrikeAI（社区预览）

**说人话，打授权目标。** AI 原生红队行动系统的社区入口。

- 站点：https://kestrel-y.github.io/kestrelstrikeai/
- 仓库：https://github.com/Kestrel-Y/kestrelstrikeai
- 预览包：https://github.com/Kestrel-Y/kestrelstrikeai/releases

---

## 开源边界

本仓库**只公开**：

1. 社区文档站（GitHub Pages）
2. **预览编译包**（Releases 附件，无源码）
3. 试用申请渠道（Issues）

**核心源码、签发私钥、C2 内部实现等不开源。** 获准后私下发放部署包与试用证书。上游 CyberStrikeAI 仍可按其 Apache-2.0 条款独立使用。完整条款见 [开源免责协议](https://kestrel-y.github.io/kestrelstrikeai/docs/disclaimer.html) 与 [NOTICE.md](NOTICE.md)。

---

## 部署手册

面向**获准试用 / 正式交付**后的落地。公开预览包可先下载体验；完整发行包与激活码需通过 [申请试用](https://kestrel-y.github.io/kestrelstrikeai/#ks-apply) 审核后发放。

图文版：[部署手册（站点）](https://kestrel-y.github.io/kestrelstrikeai/docs/deployment.html)

### 0. 先选部署路径

| 场景 | 推荐路径 | 架构 |
|---|---|---|
| Kali / 红队本机（要本机渗透工具链） | 解压二进制 + systemd | `linux/amd64`（为主） |
| 干净 Linux 服务器（只要 Web 平台） | Docker Compose | `linux/amd64` · `linux/arm64` |
| macOS 本地体验 / 预览 | 预览包直接跑二进制 | `darwin/amd64` · `darwin/arm64` |
| 内网隔离、无外网 | 离线发行包 + 离线激活 | 同 Linux 二进制 |
| 私有镜像仓库 | `docker pull` + compose pull | 按仓库标签 |

> 容器镜像**刻意不含** nmap / sqlmap / nuclei 等工具。要让 Agent 真正调工具，请用 **Kali 本机二进制**，或自行基于 Kali 扩展镜像。

### 1. 下载与自检

```bash
# 预览包：Releases 页下载最新 preview-* 附件
# https://github.com/Kestrel-Y/kestrelstrikeai/releases

tar xzf kestrelstrikeai-preview-*.tar.gz
cd kestrelstrikeai-*/
./kestrelstrike-ai --build-info
```

核对输出中的：

1. `version` — 是否为目标版本  
2. `channel` — 正式交付应为 `release`；社区预览常见 `dev` / `preview`  
3. `license_public_key` — 正式包应已编入厂商公钥  

### 2. Kali / Linux 本机（二进制，推荐红队）

#### 2.1 依赖

```bash
sudo apt-get update && sudo apt-get install -y ca-certificates tzdata curl
# 按需安装工具：nmap httpx nuclei sqlmap ffuf hydra …
```

#### 2.2 解压与启动

```bash
sudo mkdir -p /opt/kestrelstrike
sudo tar xzf kestrelstrike-*-linux-amd64.tar.gz -C /opt/kestrelstrike --strip-components=1
cd /opt/kestrelstrike
cp config.example.yaml config.yaml   # 改端口、模型通道、授权等
./kestrelstrike-ai --config config.yaml
# 浏览器打开提示地址；首次到 /activate 完成激活
```

- 默认交付：`linux/amd64`  
- ARM 云主机 / 部分板卡：使用对应的 `linux-arm64` 包  

#### 2.3 systemd（长期运行）

```bash
# 示例思路（正式包内通常附带 install.sh / unit 模板）：
# WorkingDirectory=/opt/kestrelstrike
# ExecStart=/opt/kestrelstrike/kestrelstrike-ai --config config.yaml
sudo systemctl enable --now kestrelstrike
```

### 3. Docker / Compose（Linux 服务器）

```bash
# 获准后拿到的发行包内通常含 Dockerfile / docker-compose.yml
docker compose up -d --build

# 或私有仓库只拉不建：
# docker compose -f docker-compose.pull.yml up -d
```

注意：

- 持久化：`data/`（库、会话、证书）、自定义 skills/roles（如有）  
- 端口：以包内 compose 为准（常见 `18080`）  
- 生产务必 TLS 或反向代理；**立即修改默认管理员密码**  

### 4. macOS 预览

```bash
tar xzf kestrelstrikeai-preview-darwin-*.tar.gz
cd kestrelstrikeai-preview-darwin-*/
cp config.example.yaml config.yaml
./kestrelstrike-ai
```

社区公开预览包当前常见为 **darwin/amd64**（Apple Silicon 可用 Rosetta，或等待 arm64 预览包）。仅用于授权范围内的本地体验，不作为生产交付。

### 5. 激活（试用版 / 正式版 / 企业版）

| 版本 | 说明 |
|---|---|
| **试用版** `trial` | 能力与正式版相同；需申请后签发 |
| **正式版** `pro` | 不含企业专属：C2 / 外部 MCP / Skills 配置 / 知识库配置 |
| **企业版** `enterprise` | 全功能（默认全开） |

步骤：

1. 打开产品 **`/activate`**  
2. **还没有激活码**：先走 [申请试用版激活](https://kestrel-y.github.io/kestrelstrikeai/#ks-apply) 或下方 Issues 模板  
3. **有激活码且能出网**：在线激活  
4. **内网隔离**：导出激活请求 → 发给厂商 → 导入证书  

已部署时，可把 `/activate` 页上的**实例指纹 / 激活请求**一并填进申请，便于签发绑定本机的试用证书。

### 6. 备份与升级

- **备份**：`config.yaml`、`data/`、自定义资源目录  
- **预览包升级**：整包替换，保留 `data/`  
- **正式客户**：按厂商升级包 / 控制台在线更新指引操作  

### 7. 排障速查

| 现象 | 排查 |
|---|---|
| 起不来 / 端口占用 | 看 `config.yaml` 中 `server` 端口；`ss -lntp` 查占用 |
| 授权不可用 | 打开 `/activate`；核对通道与公钥；试用是否过期 |
| Agent 调不到工具 | 容器内本身无渗透工具 → 改 Kali 本机部署或扩展镜像 |
| 模型报错 | 检查 `ai.channels` 的 `base_url` / `api_key` / 代理 |

---

## 申请试用

打开 [申请试用版激活](https://kestrel-y.github.io/kestrelstrikeai/#ks-apply)，或直接用 Issues 模板：

| 角色 | 模板 |
|---|---|
| 企业安全团队 | [trial-enterprise](https://github.com/Kestrel-Y/kestrelstrikeai/issues/new?template=trial-enterprise.yml) |
| 个人红队 | [trial-redteam](https://github.com/Kestrel-Y/kestrelstrikeai/issues/new?template=trial-redteam.yml) |
| 白帽子 | [trial-whitehat](https://github.com/Kestrel-Y/kestrelstrikeai/issues/new?template=trial-whitehat.yml) |
| 逆向人员 | [trial-reverser](https://github.com/Kestrel-Y/kestrelstrikeai/issues/new?template=trial-reverser.yml) |
| 其他 | [trial-other](https://github.com/Kestrel-Y/kestrelstrikeai/issues/new?template=trial-other.yml) |

---

## 更多文档

| 文档 | 说明 |
|---|---|
| [快速开始](https://kestrel-y.github.io/kestrelstrikeai/docs/quickstart.html) | 三分钟上手摘要 |
| [部署手册（站点全文）](https://kestrel-y.github.io/kestrelstrikeai/docs/deployment.html) | 与本章同内容的 HTML 版 |
| [系统架构](https://kestrel-y.github.io/kestrelstrikeai/docs/architecture.html) | 分层架构与上游致谢 |
| [安全声明](https://kestrel-y.github.io/kestrelstrikeai/docs/security.html) | 授权用途与合规底线 |
| [开源免责协议](https://kestrel-y.github.io/kestrelstrikeai/docs/disclaimer.html) | 双层许可与预览特别条款 |

---

## 安全与免责

仅限已获得目标系统权利人**明确书面授权**的安全测试、红队演练与防御性研究。

联系：kestrel-c2@outlook.com  
安全漏洞请按 [SECURITY.md](SECURITY.md) 私下报告（主题标注 `[SECURITY]`）。

---

## 上游前身与基石

本产品衍生自开源项目 **[CyberStrikeAI](https://github.com/Ed1s0nZ/CyberStrikeAI)**（Apache License 2.0）。上游奠定了：

- **Go + Gin** Web / API 骨架
- **Eino 多代理**编排
- **MCP 联邦**（内置 / YAML / 外部 MCP）
- **多层作战记忆**与证据回溯
- **AI 围栏 · HITL** 高风险动作人工确认

详见 [系统架构与上游基石](https://kestrel-y.github.io/kestrelstrikeai/docs/architecture.html)。上游荣誉与社区归属上游项目，不代表本分支。
