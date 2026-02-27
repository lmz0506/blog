---
layout: doc
title: "\U0001F5A7nginx常用配置"
category: Nginx
date: '2025-12-16'
tags:
  - nginx
  - 运维
---
> 我用到过的一些nginx常规配置
>

---

## <font style="color:rgb(51, 51, 51);">代理示例</font>
```nginx
#常用
location /test-api/ {
    proxy_pass  http://127.0.0.1:9009/;
    proxy_read_timeout 300s;
    proxy_send_timeout 300s;
    proxy_set_header Host $proxy_host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
}
## 补全，更多的proxy_set_header可以让接口程序获取更多的接口请求信息
location /test-api2/ {
    proxy_pass http://localhost:9002/;
    proxy_read_timeout 300s;
    proxy_send_timeout 300s;
    proxy_set_header Host $proxy_host;
    proxy_set_header X-Forwarded-Host $server_name;
    proxy_set_header X-Forwarded-Proto https;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header REMOTE_ADDR $remote_addr;
    proxy_set_header Upgrade $http_upgrade;
	  proxy_set_header Connection "upgrade";
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
}

   
```

### 透传了前缀处理
`  **<font style="color:#DF2A3F;">rewrite ^/api/(.*)$ /$1 break;</font>**`

```nginx
	# api
		location /api/ {
	    rewrite ^/api/(.*)$ /$1 break;
  		proxy_pass http://production:8200/;
  		proxy_set_header Host $host;
  		proxy_http_version 1.1;
  		proxy_set_header X-Forwarded-Host $server_name;
  		proxy_set_header X-Forwarded-Proto https;
  		proxy_set_header X-Real-IP $remote_addr;
  		proxy_set_header REMOTE_ADDR $remote_addr;
  		proxy_set_header Upgrade $http_upgrade;
  		proxy_set_header Connection "upgrade";
  		proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
	}
```

## <font style="color:rgb(51, 51, 51);">https 配置 (SSL)</font>
> <font style="color:rgb(119, 119, 119);">🧅</font><font style="color:rgb(119, 119, 119);"> listen</font>
>
> <font style="color:rgb(119, 119, 119);">🧅</font><font style="color:rgb(119, 119, 119);"> ssl_certificate</font>
>
> <font style="color:rgb(119, 119, 119);">🧅</font><font style="color:rgb(119, 119, 119);"> ssl_certificate_key</font>
>
> <font style="color:rgb(119, 119, 119);">🧅</font><font style="color:rgb(119, 119, 119);"> proxy_set_header X-Forwarded-Proto https; </font>
>

```nginx
 server {
    listen   443 ssl;
    server_name  xx.cn;
    ssl_certificate      /usr/local/openresty/nginx/xx.cn_nginx/xx.cn.pem;
    ssl_certificate_key  /usr/local/openresty/nginx/xx.cn_nginx/xx.tannn.cn.key;
    ssl_session_cache    shared:SSL:1m;
    ssl_session_timeout  5m;
    client_max_body_size 500M;
    # SSL Settings
    ssl_ciphers  HIGH:!aNULL:!MD5;
    # 设置运行的证书版本
    ssl_protocols TLSv1 TLSv1.1 TLSv1.2;
    ssl_prefer_server_ciphers   on;
    #  Gzip Settings
    gzip on;
    gzip_disable "msie6";

  
    location / {
        #防止跨站脚本 Cross-site scripting (XSS)                                                                                                  
  			add_header X-XSS-Protection "1; mode=block";                                                                                                                                                        
  			#	并不限制内容加载来源                                                                                    
  			add_header Content-Security-Policy "script-src * 'unsafe-inline' 'unsafe-eval'"; 
      	proxy_pass http://localhost:8081/;
        proxy_set_header   X-Forwarded-Proto https;  # 转发时使用https协议
        proxy_set_header REMOTE_ADDR $remote_addr;
        proxy_set_header Host $http_host;
        proxy_set_header Connection "";
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

## <font style="color:rgb(51, 51, 51);">http 自动导向https</font>
> <font style="color:rgb(119, 119, 119);">rewrite ^(.*) https://$server_name$1 permanent;</font>
>

```nginx

server {
    listen       80;
    server_name  nexus.tannn.cn;
    #charset koi8-r;
    #access_log  logs/host.access.log  main;
    rewrite ^(.*) https://$server_name$1 permanent;


   # 其他请求 -> HTTPS:81
   # location / {
   #    rewrite ^(.*) https://$server_name:81$1 permanent;
   # }
}    


    
 server {
    listen   443 ssl;
    server_name  xx.cn;
    ssl_certificate      /usr/local/openresty/nginx/xx.cn_nginx/xx.cn.pem;
    ssl_certificate_key  /usr/local/openresty/nginx/xx.cn_nginx/xx.tannn.cn.key;
    ssl_session_cache    shared:SSL:1m;
    ssl_session_timeout  5m;
    client_max_body_size 500M;
    # SSL Settings
    ssl_ciphers  HIGH:!aNULL:!MD5;
    ssl_protocols TLSv1 TLSv1.1 TLSv1.2;
    ssl_prefer_server_ciphers   on;
    #  Gzip Settings
    gzip on;
    gzip_disable "msie6";

  
    location / {
      	#防止跨站脚本 Cross-site scripting (XSS)                                                                                                  
  			add_header X-XSS-Protection "1; mode=block";                                                                                                                                                        
  			#	并不限制内容加载来源                                                                                    
  			add_header Content-Security-Policy "script-src * 'unsafe-inline' 'unsafe-eval'"; 
      	proxy_pass http://localhost:8081/;
        proxy_set_header   X-Forwarded-Proto https;  # 转发时使用https协议
        proxy_set_header REMOTE_ADDR $remote_addr;
        proxy_set_header Host $http_host;
        proxy_set_header Connection "";
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    
    }
}
```

## 代理静态文件
### VUE / React 
> vue项目配置了访问前缀：admin
>

> 1. `/<font style="color:#74B602;">admin</font>/index.html` 中的 `<font style="color:#74B602;">admin</font>`<font style="color:#74B602;"> </font>根据前端打包时的 `vue.config.js` 中的`<font style="color:#DF2A3F;">module.exports.publicPath</font>`和 `router/index.js`中的 `<font style="color:#080808;background-color:#ffffff;">createRouter.base</font>`设置
> 2. alias 中的地址是静态文件的绝对地址，且做好有 `chmod -R 777 ../admin` 权限
>

```nginx
## 有路由  Router 
location /admin {
  alias ../html/admin;
  index index.html;
  try_files $uri $uri/ /admin/index.html;
}

location /todo {
  alias   /usr/local/openresty/nginx/todo/;
  index index.html;
  try_files $uri $uri/ /todo/index.html;
}


## 没路由 e.g http://127.0.0.1/admin -> /root/html/admin/
## 也可以用alias写全路径 alias /root/html/admin/
location /admin {
   root   ../html/;
   index  index.html;
}


```

### <font style="color:rgb(51, 51, 51);">纯静态</font>
> 代理到 所有文件的公共根目录
>
> 目录结构
>
> + dashboard/html/xx.html
> + dashboard/js/xx.js
> + dashboard/css/xx.css
>
> 访问 [http://127.0.0.1:80/bistdashboard/html/index.html](http://127.0.0.1:80/bistdashboard/html/index.html)
>

```nginx
# 代理公共目录
location /bistdashboard/ {
    alias /tan/test/dashboard/;
}

 
# 代理指定页面 index
location / {
    root /home/nginxconfig/html;
    index test.html;
}
# 代理指定页面 try_files
#  =404 如果文件不存在 → 立即返回 404，不会再去尝试其他 location 块或默认首页
location / {
    root /home/nginxconfig/html;
    try_files /test.html =404;
}
```

### <font style="color:rgb(51, 51, 51);">搭建文件服务器</font>
> auth_basic_user_file: 开的基本验证的密码文件
>
> + [配置登录验证](#n6U9K)
>

```nginx
 location / {
      # 文件目录
      alias D:/share;
      # 基本验证 可选
      auth_basic "使用文件服务验证";
      auth_basic_user_file C:/nginx/conf/htpasswd;
      # 文件显示功能
      autoindex on;    #开启索引功能
      autoindex_exact_size off;  #关闭计算文件确切大小（单位bytes），只显示大概大小（单位kb、mb、gb）
      autoindex_localtime on;   #显示本机时间而非 GMT 时间
  }
```

## 限制上传文件大小
> client_max_body_size 主要就是限制请求的body数据大小
> 
> client_body_buffer_size 上传文件如果太多缓存空间可能也需要处理下
> 

```nginx
文件大小限制

http {
    include       mime.types;
    default_type  application/octet-stream;

    #log_format  main  '$remote_addr - $remote_user [$time_local] "$request" '
    #                  '$status $body_bytes_sent "$http_referer" '
    #                  '"$http_user_agent" "$http_x_forwarded_for"';

    #access_log  logs/access.log  main;

    sendfile        on;
    #tcp_nopush     on;
     #keepalive_timeout  0;
    # 大小
    client_max_body_size 1024M;
    # timeout时间
    keepalive_timeout  1800;
    # 设置缓存
    client_body_buffer_size 16k; 
    #gzip  on;
}
```

## 设置响应时间
```nginx
server {
    listen 80;
    server_name api.example.com;

    location /api/ {
        proxy_pass http://127.0.0.1:8080;   # 你的上游
        proxy_connect_timeout                5s;  # 建连
        proxy_send_timeout                  10s;  # 发请求
        proxy_read_timeout                  30s;  # 等响应
    }
}
```

ai说的默认值。我没仔细看过

| 指令 | 默认值 |
| --- | --- |
| proxy_connect_timeout | 60 s |
| proxy_send_timeout | 60 s |
| proxy_read_timeout | 60 s |


## <font style="color:rgb(51, 51, 51);">负载均衡</font>
> + <font style="color:rgb(119, 119, 119);">权重</font>
>     - <font style="color:rgb(119, 119, 119);">weight (数字越大访问比例越高) : weight和访问比率成正比</font>
>     - <font style="color:rgb(119, 119, 119);">iphash(ip_hash可以和weight配合使用)：每个请求都根据访问ip的hash结果分配，经过这样的处理，每个访客固定访问一个后端服务。</font>
>     - <font style="color:rgb(119, 119, 119);">least_conn(least_conn可以和weight配合使用)：将请求分配到连接数最少的服务上</font>
>     - <font style="color:rgb(119, 119, 119);">fair(fair可以和weight配合使用)：按后端服务器的响应时间来分配请求，响应时间短的优先分配</font>
>

```nginx
upstream www.api.com {
    iphash;
    server 172.31.253.1:1122 weight=1;
    server 172.31.253.2:1122 weight=2;
}
server {
    listen       8888;
    # 多 server_name
    server_name  172.31.253.1 xx.xx.com 123.123.1.14;
    #client_max_body_size 200m;

    #charset koi8-r;

    #access_log  logs/host.access.log  main;

    location /api {
        proxy_pass http://www.api.com/api;	
        proxy_redirect off;
        proxy_set_header Host $host:8888;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_read_timeout 300; 			
    }	
}	
```

## 重定向到其他地址
> <font style="color:rgb(119, 119, 119);">rewrite</font>
>

### 带参数
```nginx
server {
	listen   8085 ssl;
	server_name  web.xxx.com;
	ssl_certificate      web.xxx.com.pem;
	ssl_certificate_key  web.xxx.com.key;
	ssl_session_cache    shared:SSL:1m;
	ssl_session_timeout  5m;
	client_max_body_size 500M;
	ssl_ciphers  HIGH:!aNULL:!MD5;
	ssl_prefer_server_ciphers   on;
		
	
	location / {
		rewrite ^(.*) https://web.xxx.com:8085/RMS/html/index02.html$1 permanent;
	}
	
	location /RMS {
		proxy_pass http://127.0.0.1:8084/RMS;
		proxy_redirect off;
		proxy_set_header   X-Forwarded-Proto https;
    proxy_set_header Host $host:8085;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_read_timeout 300; 
		
	}
}
```

### 不带参数
```nginx
server {
	listen   8085 ssl;
	server_name  web.xxx.com;
	ssl_certificate      web.xxx.com.pem;
	ssl_certificate_key  web.xxx.com.key;
	ssl_session_cache    shared:SSL:1m;
	ssl_session_timeout  5m;
	client_max_body_size 500M;
	ssl_ciphers  HIGH:!aNULL:!MD5;
	ssl_prefer_server_ciphers   on;
		
	
	location / {
		rewrite ^(.*) https://web.xxx.com:8085/RMS/html/index02.html;
	}
	
	location /RMS {
		proxy_pass http://127.0.0.1:8084/RMS;
		proxy_redirect off;
		proxy_set_header   X-Forwarded-Proto https;
    proxy_set_header Host $host:8085;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_read_timeout 300; 
		
	}
}
```

## 跨域处理
```nginx
location / {  
    add_header Access-Control-Allow-Origin *;
    add_header Access-Control-Allow-Methods 'GET, POST, OPTIONS';
    add_header Access-Control-Allow-Headers 'DNT,X-Mx-ReqToken,Keep-Alive,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Authorization';

    if ($request_method = 'OPTIONS') {
        return 204;
    }
} 
```

## <font style="color:rgb(51, 51, 51);">流穿透</font>
> <font style="color:rgb(119, 119, 119);">我使用的是 </font>[openresty](http://openresty.org/)<font style="color:rgb(119, 119, 119);"> 自带 stream模块</font>
>
> <font style="color:rgb(119, 119, 119);">原生请参考：</font>[我也没试过，百度来的](https://www.cnblogs.com/crysmile/p/9565048.html)
>
> <font style="color:rgb(119, 119, 119);">mysql redis</font>
>

### <font style="color:rgb(119, 119, 119);">MySql</font>
> <font style="color:rgb(119, 119, 119);"> stream 模块配置和 http 模块在相同级别</font>
>

```nginx
stream {

    upstream mysql{
       hash $remote_addr consistent;
      # $binary_remote_addr;
       server 127.0.0.1:3306 weight=5 max_fails=3 fail_timeout=30s;
    }

    server {
       listen 3317;#数据库服务器监听端口
       proxy_connect_timeout 10s;
       proxy_timeout 300s;#设置客户端和代理服务之间的超时时间，如果5分钟内没操作将自动断开。
       proxy_pass mysql;
    }
}
```

### Redis
> <font style="color:rgb(119, 119, 119);">stream 模块配置和 http 模块在相同级别</font>
>

```nginx
stream {

    upstream redis {
        server 127.0.0.1:6379 max_fails=3 fail_timeout=30s; 
    }
 
    server {
        listen 6616;
        proxy_connect_timeout 1s;
        proxy_timeout 3s;
        proxy_pass redis;
    }
}
```

## MinIO
> 1. 9100 ：web控制台默认端口
> 2. 9000 ：api 接口端口
> 3. [官网](https://min.io/docs/minio/linux/integrations/setup-nginx-proxy-with-minio.html)
> 4. <font style="color:#DF2A3F;">下面的配置是分布式minio前的版本，如果最新的minio请参考官网</font>
>

### 独立域名
```nginx
upstream minio {
	server 127.0.0.1:9000;
	# server 127.0.0.1:9000;
}

upstream console {
	server 127.0.0.1:9100;
	# server 127.0.0.1:9100;
}


## 控制台
server {
	listen   8081 ssl;
	server_name  example.com;
	ssl_certificate      example.pem;
	ssl_certificate_key  example.key;
	ssl_session_cache    shared:SSL:1m;
	ssl_session_timeout  5m;
	client_max_body_size 500M;
	ssl_ciphers  HIGH:!aNULL:!MD5;
	ssl_prefer_server_ciphers   on;
		
	
	location / {
		proxy_set_header Host $http_host;
		proxy_set_header X-Real-IP $remote_addr;
		proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
		proxy_set_header X-Forwarded-Proto $scheme;
		proxy_set_header X-NginX-Proxy true;

		# This is necessary to pass the correct IP to be hashed
		real_ip_header X-Real-IP;

		proxy_connect_timeout 300;
		
		# To support websocket
		proxy_http_version 1.1;
		proxy_set_header Upgrade $http_upgrade;
		proxy_set_header Connection "upgrade";
		
		chunked_transfer_encoding off;

		proxy_pass http://console;
	}
}

## 接口
server {
	listen   443 ssl;
	server_name  example.com;
	ssl_certificate      example.pem;
	ssl_certificate_key  example.key;
	ssl_session_cache    shared:SSL:1m;
	ssl_session_timeout  5m;
	client_max_body_size 500M;
	ssl_ciphers  HIGH:!aNULL:!MD5;
	ssl_prefer_server_ciphers   on;
	
	location / {
		proxy_set_header Host $http_host;
		proxy_pass http://minio;
	}
}
```

### 非独立域名
> 主要是 api 接口的需要特殊处理，如下：
>

```nginx
## 文件访问：http://127.0.0.1/files/xx/xx/xx.png
location ~^/files {
   proxy_buffering off;
   proxy_set_header Host $http_host;
   rewrite ^/files/(.*)$ /$1 break;
   proxy_pass http://localhost:9000;
 }
```

## <font style="color:rgb(51, 51, 51);">IPV6配置</font>
### <font style="color:rgb(51, 51, 51);">同时监听IPV4和IPV6</font>
```plain
server {
    listen [::]:80;
}
```

### <font style="color:rgb(51, 51, 51);">只监听IPV6</font>
```plain
server {
    listen [::]:80 default ipv6only=on;
}
```

### <font style="color:rgb(51, 51, 51);">监听指定IPV6地址</font>
```plain
server {
    listen [xx:xx:xx:xx:1]:80;
}
```

## <font style="color:rgb(51, 51, 51);">防止独立IP被其它恶意域名恶意解析</font>
> [参考](https://www.cnblogs.com/dadonggg/p/8398112.html)
>

1. <font style="color:rgb(51, 51, 51);">定义一个默认的空主机名，禁止其访问，需要通过的域名一定要在其他server里配置。</font><font style="color:rgb(119, 119, 119);">也可以直接重定向： rewrite ^(.*) </font>http://www.baidu.com/<font style="color:rgb(119, 119, 119);">$1 permanent; </font>

```plain
### 80
server {
    listen       80  default_server;
    server_name  _;
    access_log   off;
    return       444;
}

## ssl 
server {
    listen 443 ssl;     
    server_name  _;
    ssl_certificate      xxx.pem;
    ssl_certificate_key  xx.key;
    access_log   off;
    return       444;
}
```

## <font style="color:rgb(51, 51, 51);">配置登录验证</font>
> 注意会跟接口原本的`_<font style="color:#DF2A3F;background-color:#ffffff;">Authorization</font>_`冲突
>
> + 要么改变接口的认证方式
> + 要么关闭nginx的登录验证
> + 使用lua重写nginx的验证方式
>

### <font style="color:rgb(51, 51, 51);">安装htpasswd工具</font>
```shell
## centos  
yum -y install nginx    #安装nginx
yum -y install httpd-tools    #安装httpd-tools	
## ubuntu 
sudo apt search htpasswd
sudo apt install apache2-utils
```

### <font style="color:rgb(51, 51, 51);">生成密钥文件</font>
> 1. 创建文件 `touch  htpasswd`
> 2. 在执行下面的
>

```shell
[root@test102 conf.d]# htpasswd -cm /etc/nginx/htpasswd crystal     #/etc/nginx/htpasswd就是配置文件里面配置的密码文件，crystal就是用户名
New password:     #输入密码
Re-type new password:     #再次输入密码，回车
Adding password for user crystal
```

### <font style="color:rgb(51, 51, 51);">在原有密码文件中增加下一个用户</font>
```shell
htpasswd -b /etc/nginx/htpasswd ren002 456

cat /etc/nginx/htpasswd
ren001:$apr1$Ln1ZsyVn$2hn3VFqP0L5tNA1UCSU8F.
ren002:$apr1$hCiMb9jc$Z.m7ZgOBCj0ISeIieTaVy/    #去掉c选项，即可在第一个用户之后添加第二个用户，依此类推
```

### <font style="color:rgb(51, 51, 51);">不更新密码文件，只显示加密后的用户名和密码</font>
```shell
htpasswd -nb ren002 456
ren002:$apr1$DT53A20W$YRS7p4j.1Wum9q0kG3OQv.    #不更新.passwd文件，只在屏幕上输出用户名和经过加密后的密码
```

### <font style="color:rgb(51, 51, 51);">用htpasswd命令删除用户名和密码</font>
```shell
htpasswd -D /etc/nginx/htpasswd ren002
Deleting password for user ren002

cat /etc/nginx/htpasswd
ren001:$apr1$Ln1ZsyVn$2hn3VFqP0L5tNA1UCSU8F.
```

### <font style="color:rgb(51, 51, 51);">用 htpasswd 命令修改密码</font>
```shell
htpasswd -D /etc/nginx/htpasswd ren001
Deleting password for user ren001

htpasswd -b /etc/nginx/htpasswd ren001 123456
Adding password for user ren001
```

### <font style="color:rgb(51, 51, 51);">htpasswd命令选项参数说明</font>
<font style="color:rgb(119, 119, 119);">-c 创建一个加密文件</font>

<font style="color:rgb(119, 119, 119);">-n 不更新加密文件，只将htpasswd命令加密后的用户名，密码显示在屏幕上</font>

<font style="color:rgb(119, 119, 119);">-m 默认htpassswd命令采用MD5算法对密码进行加密</font>

<font style="color:rgb(119, 119, 119);">-d htpassswd命令采用CRYPT算法对密码进行加密</font>

<font style="color:rgb(119, 119, 119);">-p htpassswd命令不对密码进行进行加密，即明文密码</font>

<font style="color:rgb(119, 119, 119);">-s htpassswd命令采用SHA算法对密码进行加密</font>

<font style="color:rgb(119, 119, 119);">-b htpassswd命令行中一并输入用户名和密码而不是根据提示输入密码</font>

<font style="color:rgb(119, 119, 119);">-D 删除指定的用户</font>

### <font style="color:rgb(51, 51, 51);">nginx配置登录验证</font>
> <font style="color:rgb(119, 119, 119);">windows路径注意：</font>
>
> <font style="color:rgb(119, 119, 119);">❌</font><font style="color:rgb(119, 119, 119);">D:\tools\nginx\openresty-1.19.3.1-win64\htpasswd</font>
>
> <font style="color:rgb(119, 119, 119);">✅</font><font style="color:rgb(119, 119, 119);">D:/tools/nginx/openresty-1.19.3.1-win64/htpasswd</font>
>
> <font style="color:rgb(119, 119, 119);">Linux 路径注意权限问题</font>
>

```nginx
location /password {
    # proxy_pass http://10.0.0.102:5601$request_uri;        
    #加上下面两行内容：
    auth_basic "登陆验证";
    auth_basic_user_file /etc/nginx/htpasswd;   #/etc/nginx/htpasswd是密码文件，路径自定义
}
## 例子
location /api {
    #加上下面两行内容：
    auth_basic "登陆验证";
    auth_basic_user_file D:/tools/nginx/openresty-1.19.3.1-win64/htpasswd;   #/etc/nginx/htpasswd是密码文件，路径自定义
    proxy_pass http://192.168.0.65:9004/;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Host $server_name;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
}
```

### okhtpp使用
```java
 private void okHttpClient(long connectTimeout, long writeTimeout, long readTimeout, Proxy proxy) {
        OkHttpClient.Builder client = new OkHttpClient.Builder();
        client.connectTimeout(connectTimeout, TimeUnit.SECONDS);
        client.writeTimeout(writeTimeout, TimeUnit.SECONDS);
        client.readTimeout(readTimeout, TimeUnit.SECONDS);
        if (Objects.nonNull(proxy)) {
            client.proxy(proxy);
        }
        client.authenticator(new Authenticator() {
            @Override
            public Request authenticate(Route route, Response response) throws IOException {
                String credential = Credentials.basic(name, password);
                return response.request().newBuilder().header("Authorization", credential).build();
            }
        });
        this.okHttpClient = client.build();
    }
```

## <font style="color:rgb(51, 51, 51);">Spring boot admin</font>
> 1. public-url： 配置访问域名
> 2. 如果要设置前缀：
>     - context-path: /abc
>     - public-url: https://m.tannn.cn/abc
>     - nginx  
>         * location /abc { proxy_pass  https://m.tannn.cn/abc; }
>

```yaml
## spring配置文件
server:
  port: 8001
  forward-headers-strategy: native
spring:
  profiles:
    active: dev
  boot:
      context-path: /
      ui:
        public-url: https://m.tannn.cn/
        cache:
          no-cache: true
## nginx配置
location / {
    proxy_pass http://localhost:8001;
    proxy_set_header Host $proxy_host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-Host $host;
    proxy_http_version 1.1;
    proxy_set_header X-Forwarded-Proto https;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Port $server_port;
}
```

### 如果配置文件不配置的情况下要用前缀
> 但是我没测试过
>

1. 启动jar时加上 `server.servlet.context-path`

```shell
nohup java -jar springbootadmin-1.0-SNAPSHOT.jar --server.servlet.context-path=/admin
```

2. nignx 如下配置

```nginx
location /admin {
        rewrite ^~/admin/(.*) /$1 break;
        proxy_pass http://localhost:8001;
}
```

## <font style="color:rgb(51, 51, 51);">正确地识别实际用户发出的协议是 http 还是 https</font>
> 配置X-Forwarded-Proto
>

```nginx
proxy_set_header X-Forwarded-Proto $scheme;
proxy_set_header X-Forwarded-Port $server_port;
```

## websocket
[WebSocket 配置](https://www.yuque.com/tanning/mbquef/mbcgixgixac1fkor?singleDoc#)



1. http版本一定要是1.1 +
2. <font style="color:rgb(34, 34, 34);">Connection: 规定必需的字段，值必需为 Upgrade</font>
3. <font style="color:rgb(34, 34, 34);">Upgrade: 规定必需的字段，其值必需为 websocket</font>

```nginx
map $http_upgrade $connection_upgrade{
    default upgrade;
    '' close;
}

location /ws {
      proxy_pass http://chat:9009/;
      proxy_http_version 1.1;
      proxy_set_header Host $host;
      # 关闭重定向
  		proxy_redirect off;
      # 设置心跳，保持长连接
      proxy_connect_timeout 4s;               
      proxy_read_timeout 60s;                  #如果没效，可以考虑这个时间配置长一点
      proxy_send_timeout 12s;                  
      # 下面这两行是关键
      proxy_set_header Upgrade $http_upgrade;
      proxy_set_header Connection $connection_upgrade;
}
```

## Nexus Httpscd 
```nginx
server {
    listen   443 ssl;
    server_name  nexus.tannn.cn;
    ssl_certificate      /nginx/https/6714068_nexus.xx.cn_nginx/nexus.tn.cn.pem;
    ssl_certificate_key  /nginx/https/6714068_nexus.xx.cn_nginx/nexus.tn.cn.key;
    ssl_session_cache    shared:SSL:1m;
    ssl_session_timeout  5m;
    client_max_body_size 500M;
    ssl_ciphers  HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers   on;
		error_page 404 /404.html;
    location / {
        proxy_pass http://localhost:8081/;
        proxy_set_header REMOTE_ADDR $remote_addr;
        proxy_set_header   X-Forwarded-Proto https;
        proxy_set_header Host $http_host;
        proxy_http_version 1.1;
        proxy_set_header Connection "";
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}

server {
		listen       80;
		server_name  nexus.xx.cn;
		#charset koi8-r;
		#access_log  logs/host.access.log  main;
		# error_page 404 /404.html;
		rewrite ^(.*) https://$server_name$1 permanent;
	} 
 
```

## openresty 隐藏版本号
> 
> 安全加固，避免暴露服务器版本信息，减少被针对性攻击的风险
> 

```nginx
## 在http节点下加入下面的配置2
http {
  #控制 Nginx 在错误页面（如 404、500）和响应头 Server 字段中是否显示 版本号
  server_tokens off;
}
```

## 优化文件传输性能
- 当启用时（on），Nginx 可以直接通过内核在文件描述符和网络套接字之间传输数据，无需将数据复制到用户空间，从而减少 CPU 和内存开销，提升静态文件（如图片、CSS、JS）的传输性能
- 适用于提供大量静态资源的场景。

```nginx
## 在http节点下加入下面的配置2
http {
  #控制是否启用操作系统的 sendfile() 系统调用来传输文件
  sendfile        on;
}
```



