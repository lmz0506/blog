---
layout: doc
title: 远程调试SpringMvc项目
category: 工具
date: '2026-01-05'
tags:
  - IDEA
  - JAVA
---
[IDEA远程debug线上项目(实操版)_瞎琢磨先生の博客-CSDN博客](https://blog.csdn.net/bnwbkiu/article/details/101237370)

[IDEA（一）如何在IDEA中远程调试Jar包_kuibuzhiqianli的博客-CSDN博客](https://blog.csdn.net/kuibuzhiqianli/article/details/96426227)



## 0. 远程调试SpringMvc项目
+ <font style="color:#F5222D;">idea中的 使用tomcat 加载项目启动的debug方式就是使用的远程调试</font>
    - <!-- 这是一张图片，ocr 内容为：运行/诗试配置 一盲 存储为项目文件(S) 名称(N: Tomcat8.5.54 TomcatServer 启动/连接 服务圣静日志代码曼盖率启 ToMcAT85.54 Templates Run Debug Coverage 启动神本: 使用欢认值 竖FtoOISapacHe-tomcaT8554csinatalna.BATrun 关机赴本: EtooLsLapAche-tomcat-8.5.54csinctalina.batstop 使用默认值 环境李量 传递环境变量 值 名称 JAVAOPTS genthbijdwp-transportdtsocketdde7.. 传输: Sharedmemory0 Socket 端口: 请试设置... 63621 -->
![IDEA远程调试代码_1.png](/assets/images/docs/IDEA%E8%BF%9C%E7%A8%8B%E8%B0%83%E8%AF%95%E4%BB%A3%E7%A0%81_1.png)![](https://cdn.nlark.com/yuque/0/2020/png/1642320/1603257718379-62670036-9a84-445e-884d-e179f3eac0e3.png)
+ <font style="color:#F5222D;">可以不用在关注日志，直接debug查询线上错误</font>
    - <font style="color:#F5222D;">调试</font><font style="color:#F5222D;"> ≠  改源码后能生效 （已线上代码为准）</font>
        * <!-- 这是一张图片，ocr 内容为：172 173 @GeTMappingC"testexampteMatcher 174 QApiOperation(value"ExampLeMatcher测试-动态查询") 175 176 PULICResuttVO0etmh 177 pabemo.setName("刘三麻子"pabemo.Ja22 DDjeCtMaPPErDBjECTHaPPeeWDUECTHaeOCtHar:eCtHar? 178 创建匹配器,即如何使用查询条件 179 ExampLeMAtCheexaMPLEMAtCheEXAmPLeMAtCher.machingO 180 空的不要 181 ndalonejpa WithIgnorenulivaLuesO 182 精确匹配 183 184 WithstringMatcherExampeatchA 185 ListpaDemoUjaeoDao.ixmleaea tion 186 returnResultvo.successo) 187 188 189 19日 每用 内存问题 开销 this-TestController@12316 JjpaDemo-UpaDemo@12320) Class nameanul 修改代码不生效 Sex女 idanull createTimeanull Noclassesloa createByanull updateTimesnull updateBy三null -->
![IDEA远程调试代码_2.png](/assets/images/docs/IDEA%E8%BF%9C%E7%A8%8B%E8%B0%83%E8%AF%95%E4%BB%A3%E7%A0%81_2.png)![](https://cdn.nlark.com/yuque/0/2020/png/1642320/1602822104111-620c5b3b-149d-4d7d-ae0e-434ddb4ca8ca.png)



## 1. Jar
### 1.1 启动jar时加入相关命令
> <font style="color:rgb(38, 38, 38);background-color:rgb(239, 240, 240);">-Xdebug -Xrunjdwp:transport=dt_socket,server=y,suspend=y,address=80</font>**<font style="color:rgb(38, 38, 38);background-color:rgb(239, 240, 240);"></font>**
>

``java -Xdebug -Xrunjdwp:transport=dt_socket,server=y,suspend=y,address=80 -jar xxxx.jar &``

#### 1.1.1 命令相关
```plain

参数含义：
-XDebug 启用调试
-Xnoagent 禁用默认sun.tools.debug调试器
-Djava.compiler=NONE 禁止 JIT 编译器的加载
-Xrunjdwp 加载JDWP的JPDA参考执行实例
transport 用于在调试程序和 JVM 使用的进程之间通讯
dt_socket 套接字传输
server=y/n JVM是否需要作为调试服务器执行
address=2345 调试服务器监听的端口号
suspend=y/n 是否在调试客户端建立连接之后启动 JVM 
注意：-jar参数不能写到-XDebug参数
```

### 1.2 启动jar
启动后会等待idea等工具的连接

![IDEA远程调试代码_4.png](/assets/images/docs/IDEA%E8%BF%9C%E7%A8%8B%E8%B0%83%E8%AF%95%E4%BB%A3%E7%A0%81_4.png)
## 2. tomcat
### 2.1 tomcat配置
<font style="color:#52C41A;">// 非必要</font>

<font style="color:#52C41A;">在服务器上 tomcat 的 bin目录下找到并打开 catalina.sh or </font><font style="color:#52C41A;">catalina.bat</font>

<font style="color:#52C41A;">大约282行</font>

```shell
if not "%JPDA_ADDRESS%" == "" goto gotJpdaAddress
## set JPDA_ADDRESS=localhost:8000 #默认
set JPDA_ADDRESS=xx # 修改端口
##eg:set JPDA_ADDRESS=0.0.0.0:1524
```

<font style="color:#000000;background-color:#FAFAFA;"></font>

### 2.2 重启tomcat
`./shutdown.sh  （windows用bat） `

#### <font style="color:#F5222D;">2.2.1 使用命令 sh catalina.sh jdpa start 进行启动服务(务必注意：此时不要再启动原来的服务，即 ./start.sh )</font>
`<font style="color:#F5222D;">sh catalina.sh jpda start （windows用bat）</font>`

## 3. 配置idea
<font style="color:#4D4D4D;">在idea中按顺序打开Run(运行) => Edit Configurations （编辑配置）=> </font>**＋**<font style="color:#4D4D4D;">Remote （远程/远程JVM调试）=> Configuration（配置），设置 远程调试的项目名字name、远程需要调试机器的IP地址host、对应的端口号port，且与上面保持一致。Transport、Debugger mode保持默认。</font>

![IDEA远程调试代码_5.png](/assets/images/docs/IDEA%E8%BF%9C%E7%A8%8B%E8%B0%83%E8%AF%95%E4%BB%A3%E7%A0%81_5.png)![](https://cdn.nlark.com/yuque/0/2020/png/1642320/1602812321525-38b124ea-7c6d-47ba-93eb-a79242dcef44.png)
![IDEA远程调试代码_6.png](/assets/images/docs/IDEA%E8%BF%9C%E7%A8%8B%E8%B0%83%E8%AF%95%E4%BB%A3%E7%A0%81_6.png)![](https://cdn.nlark.com/yuque/0/2020/png/1642320/1602812350591-fbeb80a2-b3a7-4220-b2a9-bf67b0ba25e6.png)
![IDEA远程调试代码_7.png](/assets/images/docs/IDEA%E8%BF%9C%E7%A8%8B%E8%B0%83%E8%AF%95%E4%BB%A3%E7%A0%81_7.png)![](https://cdn.nlark.com/yuque/0/2020/png/1642320/1602812409382-8351f8d2-3d2b-4b81-8753-b338cbb8786a.png)

### 3.1 配置完成后启动
![IDEA远程调试代码_8.png](/assets/images/docs/IDEA%E8%BF%9C%E7%A8%8B%E8%B0%83%E8%AF%95%E4%BB%A3%E7%A0%81_8.png)<!-- 这是一张图片，ocr 内容为：Debugger 控制台 127.0.0.1:1122",传输:'套接字传输:1 连接到目标VM,地址: -->

#### 3.1.2 启动（连接）成功
![IDEA远程调试代码_9.png](/assets/images/docs/IDEA%E8%BF%9C%E7%A8%8B%E8%B0%83%E8%AF%95%E4%BB%A3%E7%A0%81_9.png)

jar - console 先打印监听 - `Listening for transport dt_socket at address: 1122` 然后等待监听

<font style="color:#F5222D;">如果idea没有启动监听 项目不会启动，证据：</font><font style="color:#F5222D;">swagger页面不能访问</font>
![IDEA远程调试代码_10.png](/assets/images/docs/IDEA%E8%BF%9C%E7%A8%8B%E8%B0%83%E8%AF%95%E4%BB%A3%E7%A0%81_10.png)


tomcat - 先启动项目 默认监听中 <font style="color:#F5222D;">证据：</font><font style="color:#F5222D;">swagger页面在idea没有监听的情况下能访问</font>

当idea监听关闭时会打印 `Listening for transport dt_socket at address: 1122` ，表示监听





## 4. 调试开始
#### 4.1 在源码项目中打上断点
![IDEA远程调试代码_11.png](/assets/images/docs/IDEA%E8%BF%9C%E7%A8%8B%E8%B0%83%E8%AF%95%E4%BB%A3%E7%A0%81_11.png)

#### 4.2 测试是否能进入断点
##### 4.2.1 访问接口
![IDEA远程调试代码_12.png](/assets/images/docs/IDEA%E8%BF%9C%E7%A8%8B%E8%B0%83%E8%AF%95%E4%BB%A3%E7%A0%81_12.png)

##### 4.2.2 成功进入断点
![IDEA远程调试代码_13.png](/assets/images/docs/IDEA%E8%BF%9C%E7%A8%8B%E8%B0%83%E8%AF%95%E4%BB%A3%E7%A0%81_13.png)

## 5. 注意事项
### 5.1 注意：-jar参数不能写到-XDebug参数
### <font style="color:#000000;">5.2  </font><font style="color:#000000;">使用命令 sh catalina.sh jdpa start 进行启动服务(务必注意：此时不要再启动原来的服务，即 ./start.sh )</font>
### <font style="color:#000000;">5.3    </font>**java.net.ConnectException "Connection refused: connect"**<font style="color:#000000;"> </font>
#### <font style="color:#000000;">5.3.1 线上端口是否开放</font>
**nmap工具检测开放端口 （**[**参考**](https://www.cnblogs.com/dannylinux/p/9139118.html)**）**

    - rpm -ivh nmap-<font style="color:#800080;">4.11</font>-<font style="color:#800080;">1.1</font><font style="color:#000000;">.x86_64.rpm </font>
    - rpm -ivh nmap-frontend-<font style="color:#800080;">4.11</font>-<font style="color:#800080;">1.1</font><font style="color:#000000;">.x86_64.rpm</font>
    - nmap <font style="color:#800080;">127.0</font>.<font style="color:#800080;">0.1</font>

![IDEA远程调试代码_14.png](/assets/images/docs/IDEA%E8%BF%9C%E7%A8%8B%E8%B0%83%E8%AF%95%E4%BB%A3%E7%A0%81_14.png)

#### <font style="color:#000000;">5.3.2 端口是否冲突</font>
查看某个端口是否被占用: `<font style="color:#000000;">lsof lsof -i:端口号</font>`

### <font style="color:#000000;">5.4 </font>No executable code found at line
####  5.4.1 <font style="color:#4D4D4D;">被调试的服务器需要开启调试模式，服务器端的代码和本地代码必须保持一致，则会造成断点无法进入的问题。</font>
<font style="color:#4D4D4D;"></font>

