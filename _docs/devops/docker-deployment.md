---
layout: doc
title: Docker 容器化部署指南
category: DevOps
date: 2024-11-10
tags: [Docker, 容器化, 部署]
---

# Docker 容器化部署指南

Docker 是现代应用部署的重要工具，本文介绍如何使用 Docker 进行应用容器化。

## 什么是 Docker

Docker 是一个开源的容器化平台，它允许开发者将应用及其依赖打包到一个可移植的容器中。

**优势：**
- 环境一致性
- 快速部署
- 资源隔离
- 易于扩展

## Dockerfile 基础

Dockerfile 是构建 Docker 镜像的配置文件。

```dockerfile
# 使用官方 Node.js 镜像作为基础镜像
FROM node:18-alpine

# 设置工作目录
WORKDIR /app

# 复制 package.json 和 package-lock.json
COPY package*.json ./

# 安装依赖
RUN npm ci --only=production

# 复制应用代码
COPY . .

# 暴露端口
EXPOSE 3000

# 启动应用
CMD ["node", "server.js"]
```

## 常用 Docker 命令

```bash
# 构建镜像
docker build -t myapp:1.0 .

# 运行容器
docker run -d -p 3000:3000 --name myapp myapp:1.0

# 查看运行中的容器
docker ps

# 查看容器日志
docker logs myapp

# 停止容器
docker stop myapp

# 删除容器
docker rm myapp

# 进入容器
docker exec -it myapp /bin/sh
```

## Docker Compose

Docker Compose 用于定义和运行多容器 Docker 应用。

```yaml
# docker-compose.yml
version: '3.8'

services:
  web:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - DB_HOST=db
    depends_on:
      - db
    volumes:
      - ./logs:/app/logs

  db:
    image: postgres:15
    environment:
      - POSTGRES_PASSWORD=secret
      - POSTGRES_DB=myapp
    volumes:
      - postgres-data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

volumes:
  postgres-data:
```

**使用 Docker Compose：**

```bash
# 启动所有服务
docker-compose up -d

# 查看服务状态
docker-compose ps

# 查看日志
docker-compose logs -f

# 停止所有服务
docker-compose down

# 停止并删除卷
docker-compose down -v
```

## 最佳实践

### 1. 使用 .dockerignore

```
node_modules
npm-debug.log
.git
.env
*.md
```

### 2. 多阶段构建

减小镜像大小：

```dockerfile
# 构建阶段
FROM node:18 AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# 生产阶段
FROM node:18-alpine
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
EXPOSE 3000
CMD ["node", "dist/server.js"]
```

### 3. 使用健康检查

```dockerfile
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node healthcheck.js || exit 1
```

### 4. 安全考虑

```dockerfile
# 使用非 root 用户运行
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001
USER nodejs

# 只读文件系统
docker run --read-only myapp:1.0
```

## 镜像优化

1. 选择合适的基础镜像（优先使用 alpine 版本）
2. 合并 RUN 命令减少层数
3. 利用构建缓存
4. 清理不必要的文件

```dockerfile
RUN npm ci --only=production \
    && npm cache clean --force \
    && rm -rf /tmp/*
```

## 容器编排

对于生产环境，考虑使用：
- **Kubernetes**：大规模容器编排
- **Docker Swarm**：Docker 原生编排工具
- **Amazon ECS**：AWS 容器服务

## 总结

Docker 容器化能够：
1. 简化部署流程
2. 提高开发效率
3. 确保环境一致性
4. 便于扩展和维护

掌握 Docker 是现代开发者的必备技能。
