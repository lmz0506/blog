---
layout: doc
title: ClickHouse 基础
category: ClickHouse
date: '2026-02-27'
tags:
  - ClickHouse
---

## ClickHouse 基础
### ClickHouse特点
ClickHouse 是俄罗斯的 Yandex 于 2016 年开源的列式存储数据库（DBMS），使用 C++语言编写，主要用于在线分析处理查询（OLAP），能够使用 SQL 查询实时生成分析数据报告。  
官网文档：[https://clickhouse.com/docs/en/home/](https://clickhouse.com/docs/en/home/)



#### 列式存储
以下面的表为例：

<!-- 这是一张图片，ocr 内容为： -->
![](https://cdn.nlark.com/yuque/0/2025/png/23130638/1754987601340-5eea7020-aedd-45a1-9375-485ac01e80c4.png)

1）采用行式存储时，数据在磁盘上的组织结构为：

<!-- 这是一张图片，ocr 内容为： -->
![](https://cdn.nlark.com/yuque/0/2025/png/23130638/1754987601411-d6d14af7-0bc4-4db0-92d7-63472f7479c0.png)

好处是想查某个人所有的属性时，可以通过一次磁盘查找加顺序读取就可以。但是当想查所有人的年龄时，需要不停的查找，或者全表扫描才行，遍历的很多数据都是不需要的。   
2）采用列式存储时，数据在磁盘上的组织结构为：

<!-- 这是一张图片，ocr 内容为： -->
![](https://cdn.nlark.com/yuque/0/2025/png/23130638/1754987601475-a1cba55c-c492-4ecd-a19e-a5d32aa5faf8.png)

这时想查所有人的年龄只需把年龄那一列拿出来就可以了

3）列式储存的好处：

> 对于列的聚合，计数，求和等统计操作原因优于行式存储。
>
> 由于某一列的数据类型都是相同的，针对于数据存储更容易进行数据压缩，每一列选择更优的数据压缩算法，大大提高了数据的压缩比重。
>
> 由于数据压缩比更好，一方面节省了磁盘空间，另一方面对于 cache 也有了更大的发挥空间。
>



#### DBMS的功能
> 几乎覆盖了标准SQL 的大部分语法，包括 DDL 和 DML，以及配套的各种函数，用户管理及权限管理，数据的备份与恢复。
>



#### 多样化引擎
> ClickHouse 和 MySQL 类似，把表级的存储引擎插件化，根据表的不同需求可以设定不同的存储引擎。目前包括合并树、日志、接口和其他四大类 20 多种引擎。
>



#### 高吞吐写入能力
> ClickHouse 采用类LSM Tree 的结构，数据写入后定期在后台Compaction。通过类LSM tree的结构，ClickHouse 在数据导入时全部是顺序 append 写，写入后数据段不可更改，在后台 compaction 时也是多个段merge sort 后顺序写回磁盘。顺序写的特性，充分利用了磁盘的吞吐能力，即便在 HDD 上也有着优异的写入性能。
>
> 官方公开 benchmark 测试显示能够达到 50MB-200MB/s 的写入吞吐能力，按照每行100Byte 估算，大约相当于 50W-200W 条/s 的写入速度。
>



#### 数据分区与线程级并行
> ClickHouse 将数据划分为多个 partition，每个 partition 再进一步划分为多个 index granularity(索引粒度)，然后通过多个CPU 核心分别处理其中的一部分来实现并行数据处理。在这种设计下，单条 Query 就能利用整机所有CPU。极致的并行处理能力，极大的降低了查询延时。
>
> 所以，ClickHouse 即使对于大量数据的查询也能够化整为零平行处理。但是有一个弊端就是对于单条查询使用多 cpu，就不利于同时并发多条查询。所以对于高 qps 的查询业务， ClickHouse 并不是强项。
>



#### 性能对比
几款数据库做了性能对比。

 **单表查询***



 ![](WPS图片(1).jpeg)

 **关联查询***

 ![](WPS图片(2).jpeg)

> ClickHouse 像很多 OLAP 数据库一样，单表查询速度由于关联查询，而且 ClickHouse的两者差距更为明显。
>



### ClickHouse的安装
#### 环境准备
1. 确定防火墙处于关闭状态
2. CentOS取消打开文件数限制查看本机文件的限制数量：ulimit -a

> （1） 在 服务器 的 /etc/security/limits.conf 文件的末尾加入以下内容
>
> sudo vim /etc/security/limits.conf
>
> （2） 在 器 的/etc/security/limits.d/20-nproc.conf 文件的末尾加入以下内容
>
> sudo vim /etc/security/limits.d/20-nproc.conf
>
> 
>

```plain

*soft nofile 65536
*hard nofile 65536
*soft nproc 131072
*hard nproc 131072
```

```plain
*soft nofile 65536
*hard nofile 65536
*soft nproc 131072
*hard nproc 131072
```



3. 安装依赖

```plain
sudo yum install -y libtool
sudo yum install -y *unixODBC*
  
```



4. CentOS 取消 SELINUX
    - 修改/etc/selinux/config 中的 SELINUX=disabled

```plain
sudo vim /etc/selinux/config SELINUX=disabled
```

<font style="background-color:#f3bb2f;">SELINUX=disabled 注意：别改错了</font>



#### 安装
官网：[https://clickhouse.com/](https://clickhouse.com/)

下载地址：[https://packages.clickhouse.com/rpm/stable/](https://packages.clickhouse.com/rpm/stable/)



1. 创建 clickhouse 目录

```plain
mkdir clickhouse
```

2. 上传安装包到clickhouse 目录下
    - `clickhouse-common-static`
    - `clickhouse-server` 
    - `clickhouse-client` 
    - `clickhouse-common-static-dbg`
3. 安装clickhouse安装文件

```plain
sudo rpm -ivh *.rpm

查看安装情况
sudo rpm -qa|grep clickhouse 
```

4. 修改配置文件

> sudo vim /etc/clickhouse-server/config.xml
>
> 把 :: 的注释打开，这样的话才能让 ClickHouse 被除本机以外的服务器访问
>
> 
>
> 在这个文件中，有 ClickHouse 的一些默认路径配置，比较重要的  
> 数据文件路径：/var/lib/clickhouse/
>

> 日志文件路径：/var/log/clickhouse-server/clickhouse-server.log
>





#### clickHouse文件目录
> bin/    ===>  /usr/bin/   
> conf/   ===>  /etc/clickhouse-server/  
> lib/    ===>  /var/lib/clickhouse   
> log/    ===>  /var/log/clickhouse-server
>



#### 相关命令
1. 启动 Server

> sudo systemctl start clickhouse-server
>





2. 三台机器上关闭开机自启

> sudo systemctl disable clickhouse-server
>





3. 使用 client 连接 server

> clickhouse-client -m  
> clickhouse-client --user default --password 123456 --host 127.0.0.1 --port 9000 -m
>
> 
>
>  -m :可以在命令窗口输入多行命令
>

  



clickhouse安装包自带命令（推荐）

> 1. 查看状态
>
>   sudo clickhouse status
>
> 2. 启动
>
>   sudo clickhouse start
>
> 3. 重启
>
>   sudo clickhosue restart
>
> 4. 停止
>
>   sudo clickhouse stop
>







#### 安装clickhouse
1. 拉取镜像(不用使用 docker pull 命令，用docker run的方式会自动拉取镜像)

> docker run -d --name clickhouse-server_1 --ulimit nofile=262144:262144 clickhouse/clickhouse-server
>

2. 创建存放配置的目录

> sudo mkdir -p /lmz/clickhouse/conf /lmz/clickhouse/data /lmz/clickhouse/log
>

3. 将容器内配置文件拷贝到宿主机

> docker cp clickhouse-server_1:/etc/clickhouse-server/users.xml /lmz/clickhouse/conf/users.xml
>
> docker cp clickhouse-server_1:/etc/clickhouse-server/config.xml /lmz/clickhouse/conf/config.xml
>





<font style="background-color:#f3bb2f;">ps: 很重要：在本机创建一个外部的配置文件：metrika.xml    这个文件是外部配置文件，当我们需要配置clickhouse 的集群是我们会用到, 也需要挂载到docker下</font>

metrika.xml  文件内容如下：

```xml
<?xml version="1.0"?>
<yandex>
    <zookeeper-servers>
        <node>
            <host>192.168.152.150</host>

            <port>2181</port>

        </node>

    </zookeeper-servers>

</yandex>

```

如果要使用该配置文件 我们需要修改confug.xml文件：

```xml
开启我们metrika.xml中的zk属性标签
<zookeeper incl="zookeeper-servers" optional="true" />
引入我们的配置文件路径（如果是docker容器，配置docker的文件路径）
<include_from>/etc/clickhouse-server/metrika.xml</include_from>

副本同步的接口 需要配置
<interserver_http_port>9009</interserver_http_port>

指定本机的ip，不配置的话 zk可能发现不了
<interserver_http_host>192.168.152.150</interserver_http_host>

配置时区
<timezone>Asia/Shanghai</timezone>

```





4. 启动容器

> docker run -dit --name clickhouse-1 -p 8123:8123 -p 9009:9009 -p 9090:9000 --ulimit nofile=262144:262144 -v /lmz/clickhouse/data:/var/lib/clickhouse -v /lmz/clickhouse/log:/var/log/clickhouse-server -v /lmz/clickhouse/conf/config.xml:/etc/clickhouse-server/config.xml -v /lmz/clickhouse/conf/users.xml:/etc/clickhouse-server/users.xml clickhouse/clickhouse-server
>





挂载外部配置文件

> docker run -dit --name clickhouse-1 -p 8123:8123 -p 9009:9009 -p 9090:9000 --ulimit nofile=262144:262144 -v /lmz/clickhouse/data:/var/lib/clickhouse -v /lmz/clickhouse/log:/var/log/clickhouse-server -v /lmz/clickhouse/conf/config.xml:/etc/clickhouse-server/config.xml -v /lmz/clickhouse/conf/users.xml:/etc/clickhouse-server/users.xml -v /lmz/clickhouse/conf/metrika.xml:/etc/clickhouse-server/metrika.xml clickhouse/clickhouse-server
>





5. 进入clickHouse 的bin

> docker exec -it clickhouse-1 /bin/bash
>

6. 测试连接

> clickhouse client -m -h 127.0.0.1
>







### 数据类型
官方文档：[https://clickhouse.com/docs/en/sql-reference/data-types/](https://clickhouse.com/docs/en/sql-reference/data-types/)

#### 整型
固定长度的整型，包括有符号整型或无符号整型。整型范围（-2n-1~2n-1-1）：

+ Int8 - [-128 : 127]
+ Int16 - [-32768 : 32767]
+ Int32 - [-2147483648 : 2147483647]
+ Int64 - [-9223372036854775808 : 9223372036854775807]





无符号整型范围（0~2n-1）：

+ UInt8 - [0 : 255]
+ UInt16 - [0 : 65535]
+ UInt32 - [0 : 4294967295]
+ UInt64 - [0 : 18446744073709551615]



使用场景： 个数、数量、也可以存储型 id。

#### 浮点型
+ Float32 - float 
+ Float64 – double



> 使用场景：一般数据值比较小，不涉及大量的统计计算，精度要求不高的时候。比如保存商品的重量。
>
> <font style="background-color:#f3bb2f;">建议尽可能以整数形式存储数据。例如，将固定精度的数字转换为整数值，如时间用毫秒为单位表示，因为浮点型进行计算时可能引起四舍五入的误差。</font>
>

#### 布尔型
没有单独的类型来存储布尔值。可以使用 UInt8 类型，取值限制为 0 或 1。

#### Decimal型
有符号的浮点数，可在加、减和乘法运算过程中保持精度。对于除法，最低有效数字会被丢弃（不舍入）。

<font style="background-color:#f3bb2f;">有三种声明：</font>

+ Decimal32(s)，相当于 Decimal(9-s,s)，有效位数为 1~9
+ Decimal64(s)，相当于 Decimal(18-s,s)，有效位数为 1~18
+ Decimal128(s)，相当于 Decimal(38-s,s)，有效位数为 1~38 s 标识小数位

> 使用场景： 一般金额字段、汇率、利率等字段为了保证小数点精度，都使用 Decimal进行存储。
>

#### 字符串
1）String

> 字符串可以任意长度的。它可以包含任意的字节集，包含空字节。
>

2）FixedString(N)

> 固定长度 N 的字符串，N 必须是严格的正自然数。当服务端读取长度小于 N 的字符串时候，通过在字符串末尾添加空字节来达到 N 字节长度。 当服务端读取长度大于 N 的字符串时候，将返回错误消息。
>
> 与 String 相比，极少会使用 FixedString，因为使用起来不是很方便
>

<font style="background-color:#f3bb2f;">使用场景：名称、文字描述、字符型编码。 固定长度的可以保存一些定长的内容，比如一些编码，性别等但是考虑到一定的变化风险，带来收益不够明显，所以定长字符串使用意义有限</font>



#### 枚举类型
> 包括 Enum8 和 Enum16 类型。Enum 保存 'string'= integer 的对应关系。
>
> Enum8 用 'String'= Int8 对描述。
>
> Enum16 用 'String'= Int16 对描述。
>



**示例语句**

```sql
CREATE TABLE t_enum (
x Enum8('hello' = 1, 'world' = 2)
)
ENGINE = TinyLog;


INSERT INTO t_enum VALUES ('hello'), ('world'), ('hello');

如果需要看到对应行的数值，则必须将Enum 值转换为整数类型
SELECT CAST(x, 'Int8') FROM t_enum;
```



<font style="background-color:#f3bb2f;">ps: 这个x 列只能存储类型定义中列出的值：'hello'或'world'</font>

<font style="background-color:#f3bb2f;">使用场景：对一些状态、类型的字段算是一种空间优化，也算是一种数据约束。但是实际使用中往往因为一些数据内容的变化增加一定的维护成本，甚至是数据丢失问题。所以谨慎使用。</font>





#### 时间类型
目前 ClickHouse 有三种时间类型

+ Date 接受年-月-日的字符串比如 ‘2019-12-16’
+ Datetime 接受年-月-日 时:分:秒的字符串比如 ‘2019-12-16 20:50:10’
+ Datetime64 接受年-月-日 时:分:秒.亚秒的字符串比如‘2019-12-16 20:50:10.66’日期类型，用两个字节存储，表示从 1970-01-01 (无符号) 到当前的日期值。



还有很多数据结构，可以参考官方文档：[https://clickhouse.com/docs/zh/sql-reference/data-type](https://clickhouse.com/docs/zh/sql-reference/data-type)

#### 数组
> Array(T)：由 T 类型元素组成的数组。
>
> T 可以是任意类型，包含数组类型。 但不推荐使用多维数组，ClickHouse 对多维数组的支持有限。例如，不能在 MergeTree 表中存储多维数组。
>



创建数组方式 

```plain
1. 使用 array 函数
SELECT array(1, 2) AS x, toTypeName(x) ;

2. 使用方括号
SELECT [1, 2] AS x, toTypeName(x);
```





### 表引擎
官方文档：[https://clickhouse.com/docs/en/engines/table-engines/](https://clickhouse.com/docs/en/engines/table-engines/)

#### 表引擎的使用
表引擎是 ClickHouse 的一大特色。可以说， 表引擎决定了如何存储表的数据。包括：

+ 数据的存储方式和位置，写到哪里以及从哪里读取数据。
+ 支持哪些查询以及如何支持。
+ 并发数据访问。
+ 索引的使用（如果存在）。
+ 是否可以执行多线程请求。
+ 数据复制参数。



表引擎的使用方式就是必须显式在创建表时定义该表使用的引擎，以及引擎使用的相关参数。

<font style="background-color:#f3bb2f;">特别注意：引擎的名称大小写敏感</font>

#### TinyLog
以列文件的形式保存在磁盘上，不支持索引，没有并发控制。一般保存少量数据的小表，生产环境上作用有限。可以用于平时练习测试用。

如：create table t_tinylog ( id String, name String) engine=TinyLog;



#### Memory
内存引擎，数据以未压缩的原始形式直接保存在内存当中，服务器重启数据就会消失。读写操作不会相互阻塞，不支持索引。简单查询下有非常非常高的性能表现（超过 10G/s）。  
一般用到它的地方不多，除了用来测试，就是在需要非常高的性能，同时数据量又不太大（上限大概 1 亿行）的场景。

#### MergeTree
ClickHouse 中最强大的表引擎当属 MergeTree（合并树）引擎及该系列（*MergeTree）中的其他引擎，支持索引和分区，地位可以相当于 innodb 之于 Mysql。而且基于 MergeTree，还衍生除了很多小弟，也是非常有特色的引擎。



1. 建表sql

```plain
create table t_order_mt( id UInt32,
sku_id String,
total_amount Decimal(16,2), create_time Datetime
) engine =MergeTree
partition by toYYYYMMDD(create_time) primary key (id)
order by (id,sku_id);
```



2. 插入数据

```plain
insert into t_order_mt values (101,'sku_001',1000.00,'2020-06-01 12:00:00') ,
(102,'sku_002',2000.00,'2020-06-01 11:00:00'),
(102,'sku_004',2500.00,'2020-06-01 12:00:00'),
(102,'sku_002',2000.00,'2020-06-01 13:00:00'),
(102,'sku_002',12000.00,'2020-06-01 13:00:00'),
(102,'sku_002',600.00,'2020-06-02 12:00:00');
```



<font style="background-color:#f3bb2f;">MergeTree 其实还有很多参数(绝大多数用默认值即可)，但是三个参数是更加重要的，也涉及了关于MergeTree 的很多概念</font>



ps: 数据存放的目录结构说明

> bin文件：数据文件  
> mrk文件：标记文件
>
> 标记文件在 idx索引文件 和 bin数据文件 之间起到了桥梁作用。  
> 以mrk2结尾的文件，表示该表启用了自适应索引间隔。
>
> primary.idx文件：主键索引文件，用于加快查询效率。  
> minmax_create_time.idx：分区键的最大最小值。  
> checksums.txt：校验文件，用于校验各个文件的正确性。存放各个文件的size以及hash值。	
>

##### partition by 分区
1）作用

> 分区的目的主要是降低扫描的范围，优化查询速度
>

2）如果不填

> 只会使用一个分区。
>

3）分区目录

> MergeTree 是以列文件+索引文件+表定义文件组成的，但是如果设定了分区那么这些文件就会保存到不同的分区目录中。
>

4）并行

> 分区后，面对涉及跨分区的查询统计，ClickHouse 会以分区为单位并行处理。
>

5）数据写入与分区合并

> 任何一个批次的数据写入都会产生一个临时分区，不会纳入任何一个已有的分区。写入后的某个时刻（大概 10-15 分钟后），ClickHouse 会自动执行合并操作（等不及也可以手动通过 optimize 执行），把临时分区的数据，合并到已有分区中。
>
> optimize table xxxx final;
>

6）例如

> 1. 再次执行上面的插入操作
> 2. 查看数据并没有纳入任何分区
> 3. 手动执行 optimize table xxxx final;(合并所有分区)
> 4. 手动执行 optimize table xxxx partition xxxx final;(合并指定分区)
> 5. 再次查看数据
>
> 
>

```plain
insert into t_order_mt values (101,'sku_001',1000.00,'2020-06-01 12:00:00') ,
(102,'sku_002',2000.00,'2020-06-01 11:00:00'),
(102,'sku_004',2500.00,'2020-06-01 12:00:00'),
(102,'sku_002',2000.00,'2020-06-01 13:00:00'),
(102,'sku_002',12000.00,'2020-06-01 13:00:00'),
(102,'sku_002',600.00,'2020-06-02 12:00:00');
```



ps: 分区目录说明及其规则

> PartitionId_MinBlockNum_MaxBlockNum_Level  
> 分区值_最小分区块编号_最大分区块编号_合并层级
>
> 1. PartitionId
>
>   数据分区ID生成规则:数据分区规则由分区ID决定，分区ID由PARTITION BY分区键决定。
>
>   根据分区键字段类型，ID生成规则可分为：
>
> + 未定义分区键
>
>  没有定义PARTITION BY，默认生成一个目录名为all的数据分区，所有数据均存放在all目录下。
>
>  
>
> + 整型分区键
>
>  分区键为整型，那么直接用该整型值的字符串形式做为分区ID。
>
>  
>
> + 日期类分区键
>
>  分区键为日期类型，或者可以转化成日期类型。
>
>  
>
> + 其他类型分区键
>
>  String、Float类型等，通过128位的Hash算法取其Hash值作为分区ID。
>
> 
>
> 2. MinBlockNum
>
>   最小分区块编号，自增类型，从1开始向上递增。每产生一个新的目录分区就向上递增一个数字。
>
>   
>
> 3. MaxBlockNum
>
>   最大分区块编号，新创建的分区MinBlockNum等于MaxBlockNum的编号。
>
>   
>
> 4. Level
>
>   合并的层级，被合并的次数。合并次数越多，层级值越大
>
> 
>



##### primary key 主键(可选
参考：[https://zhuanlan.zhihu.com/p/588458902](https://zhuanlan.zhihu.com/p/588458902)

ClickHouse 中的主键，和其他数据库不太一样，它只提供了数据的一级索引，但是却不是唯一约束。这就意味着是可以存在相同 primary key 的数据的。  
主键的设定主要依据是查询语句中的 where 条件。

根据条件通过对主键进行某种形式的二分查找，能够定位到对应的 index granularity,避免了全表扫描。  
index granularity： 直接翻译的话就是索引粒度，指在稀疏索引中两个相邻索引对应数据的间隔。ClickHouse 中的 MergeTree 默认是 8192。官方不建议修改这个值，除非该列存在大量重复值，比如在一个分区中几万行才有一个不同数据。



**稀疏索引**



<!-- 这是一张图片，ocr 内容为： -->
![](https://cdn.nlark.com/yuque/0/2025/png/23130638/1754987601549-839cd982-6473-492c-8570-74041bf8a867.png)



稀疏索引的好处就是可以用很少的索引数据，定位更多的数据，代价就是只能定位到索引粒度的第一行，然后再进行进行一点扫描。



##### order by（必选）
order by 设定了分区内的数据按照哪些字段顺序进行有序保存。

order by 是 MergeTree 中唯一一个必填项，甚至比 primary key 还重要，因为当用户不设置主键的情况，很多处理会依照 order by 的字段进行处理（比如后面会讲的去重和汇总）。  
<font style="background-color:#f3bb2f;">要求：主键必须是order by 字段的前缀字段。</font>

> 比如 order by 字段是 (id,sku_id)	那么主键必须是 id 或者(id,sku_id)
>

##### 二级索引
目前在 ClickHouse 的官网上二级索引的功能在 v20.1.2.4 之前是被标注为实验性的，在这个版本之后默认是开启的。  
1）老版本使用二级索引前需要增加设置

> 是否允许使用实验性的二级索引（v20.1.2.4 开始，这个参数已被删除，默认开启） 
>
> set allow_experimental_data_skipping_indices=1;
>

	 

2）创建测试表

```plain
create table t_order_mt2( id UInt32,
sku_id String,
total_amount Decimal(16,2), create_time Datetime,
INDEX a total_amount TYPE minmax GRANULARITY 5
) engine =MergeTree
primary key (id)
order by (id, sku_id);
```



其中GRANULARITY N 是设定二级索引对于一级索引粒度的粒度。

3）插入数据

```plain
insert into t_order_mt2 values (101,'sku_001',1000.00,'2020-06-01 12:00:00') ,
(102,'sku_002',2000.00,'2020-06-01 11:00:00'),
(102,'sku_004',2500.00,'2020-06-01 12:00:00'),
(102,'sku_002',2000.00,'2020-06-01 13:00:00'),
(102,'sku_002',12000.00,'2020-06-01 13:00:00'),
(102,'sku_002',600.00,'2020-06-02 12:00:00')
```



4）对比效果

那么在使用下面语句进行测试，可以看出二级索引能够为非主键字段的查询发挥作用。

> clickhouse-client --send_logs_level=trace <<< 'select * from t_order_mt2 where total_amount > toDecimal32(900., 2)';
>



##### 数据 TTL
TTL 即 Time To Live，MergeTree 提供了可以管理数据表或者列的生命周期的功能。

1）列级别 TTL

> （1）创建测试表
>
> （2）插入数据（注意：根据实际时间改变）
>
> （3）手动合并，查看效果 到期后，指定的字段数据归 0
>



2）表级 TTL

> 下面的这条语句是数据会在 create_time 之后 10 秒丢失  
> alter table t_order_mt3 MODIFY TTL create_time + INTERVAL 10 SECOND;
>
> 	  
> 涉及判断的字段必须是 Date 或者 Datetime 类型，推荐使用分区的日期字段。能够使用的时间周期：  
> -SECOND
>
> -MINUTE
>
> -HOUR
>
> -DAY
>
> -WEEK
>
> -MONTH
>
> -QUARTER
>
> -YEAR
>



#### ReplacingMergeTree
ReplacingMergeTree 是 MergeTree 的一个变种，它存储特性完全继承 MergeTree，只是多了一个去重的功能。 尽管 MergeTree 可以设置主键，但是 primary key 其实没有唯一约束的功能。如果你想处理掉重复的数据，可以借助这个 ReplacingMergeTree。

1）去重时机

> 数据的去重只会在合并的过程中出现。合并会在未知的时间在后台进行，所以你无法预先作出计划。有一些数据可能仍未被处理。
>

2）去重范围

> 如果表经过了分区，去重只会在分区内部进行去重，不能执行跨分区的去重。
>
> 所以 ReplacingMergeTree 能力有限， ReplacingMergeTree 适用于在后台清除重复的数据以节省空间，但是它不保证没有重复的数据出现。
>



3）案例演示

> （1）创建表
>
> ReplacingMergeTree() 填入的参数为版本字段，重复数据保留版本字段值最大的。如果不填版本字段，默认按照插入顺序保留最后一条
>
> 2）通过测试得到结论
>
> + 实际上是使用 order by 字段作为唯一键
> + 去重不能跨分区
> + 只有同一批插入（新版本）或合并分区时才会进行去重
> + 认定重复的数据保留，版本字段值最大的
> + 如果版本字段相同则按插入顺序保留最后一笔
>
> 
>

```plain
create table t_order_rmt( id UInt32,
sku_id String,
total_amount Decimal(16,2) , create_time Datetime
) engine =ReplacingMergeTree(create_time) partition by toYYYYMMDD(create_time) primary key (id);

insert into t_order_rmt values (101,'sku_001',1000.00,'2020-06-01 12:00:00') ,
(102,'sku_002',2000.00,'2020-06-01 11:00:00'),
(102,'sku_004',2500.00,'2020-06-01 12:00:00'),
(102,'sku_002',2000.00,'2020-06-01 13:00:00'),
(102,'sku_002',12000.00,'2020-06-01 13:00:00'),
(102,'sku_002',600.00,'2020-06-02 12:00:00');

select * from t_order_rmt;(可能还未去重)

手动合并一下
OPTIMIZE TABLE t_order_rmt FINAL;

```



#### SummingMergeTree
对于不查询明细，只关心以维度进行汇总聚合结果的场景。如果只使用普通的MergeTree的话，无论是存储空间的开销，还是查询时临时聚合的开销都比较大。ClickHouse 为了这种场景，提供了一种能够“预聚合”的引擎 SummingMergeTree

案例演示:

> （1）创建表
>
> 
>
> 2）通过测试得到结论
>
> + 以 SummingMergeTree（）中指定的列作为汇总数据列
> + 可以填写多列必须数字列，如果不填，以所有非维度列且为数字列的字段为汇总数据列
> + 以 order by 的列为准，作为维度列
> + 其他的列按插入顺序保留第一行
> + 不在一个分区的数据不会被聚合
> + 只有在同一批次插入(新版本)或分片合并时才会进行聚合
>
> 
>
> <font style="background-color:#f3bb2f;">建议： 设计聚合表的话，唯一键值、流水号可以去掉，所有字段全部是维度、度量或者时间戳。</font>
>

```plain
create table t_order_smt( id UInt32,
sku_id String,
total_amount Decimal(16,2) , create_time Datetime
) engine =SummingMergeTree(total_amount) partition by toYYYYMMDD(create_time) primary key (id) order by(id,sku_id);

insert into t_order_smt values (101,'sku_001',1000.00,'2020-06-01 12:00:00'),
(102,'sku_002',2000.00,'2020-06-01 11:00:00'),
(102,'sku_004',2500.00,'2020-06-01 12:00:00'),
(102,'sku_002',2000.00,'2020-06-01 13:00:00'),
(102,'sku_002',12000.00,'2020-06-01 13:00:00'),
(102,'sku_002',600.00,'2020-06-02 12:00:00');

select * from t_order_smt;(可能还未生效)

手动合并一下
OPTIMIZE TABLE t_order_smt FINAL;




```



问题：

能不能直接执行以下 SQL 得到汇总值

> select total_amount from XXX where province_name=’’ and create_date=’xxx’;
>
> 不行，可能会包含一些还没来得及聚合的临时明细
>
> 
>
> 如果要是获取汇总值，还是需要使用 sum 进行聚合，这样效率会有一定的提高，但本身 ClickHouse 是列式存储的，效率提升有限，不会特别明显。  
> select sum(total_amount) from province_name=’’ and create_date=‘xxx’;
>



### SQL操作
官方文档：[https://clickhouse.com/docs/en/sql-reference/statements/](https://clickhouse.com/docs/en/sql-reference/statements/)

#### Insert
基本与标准 SQL（MySQL）基本一致

（1）标准

insert into [table_name] values(…),(….)

（2）从表到表的插入

insert into [table_name] select a,b,c from [table_name_2]

#### Update 和 Delete
ClickHouse 提供了 Delete 和 Update 的能力，这类操作被称为 Mutation 查询，它可以看做 Alter 的一种。  
虽然可以实现修改和删除，但是和一般的 OLTP 数据库不一样，Mutation 语句是一种很 “重”的操作，而且不支持事务。  
“重”的原因主要是每次修改或者删除都会导致放弃目标数据的原有分区，重建新分区。所以尽量做批量的变更，不要进行频繁小数据的操作。  
（1）删除操作

alter table t_order_smt delete where sku_id ='sku_001';

（2）修改操作

alter table t_order_smt update total_amount=toDecimal32(2000.00,2) where id=102;

由于操作比较“重”，所以 Mutation 语句分两步执行，同步执行的部分其实只是进行新增数据新增分区和并把旧分区打上逻辑上的失效标记。直到触发分区合并的时候，才会删除旧数据释放磁盘空间，一般不会开放这样的功能给用户，由管理员完成。



一般来说，OLAP分析数据库不推荐更新和删除，如果业务需要可以通过业务经行大批量的删除和更新，或者在删除和更新的时候重新插入新的字段

1. 修改

> 指定一个版本号的的字段，每次插入的时候版本号+1，查询时筛选版本号最大的值
>

2. 删除

> 指定一个删除标识，插入时修改这个字段的值并且版本号+1；查询时筛选版本号最大的值和未删除的标识
>



问题： 数据修改次数越多，那么这个数据量就会越大，但是在ReplacingMergeTree下面，会出现这种情况吗？

#### 查询操作
ClickHouse 基本上与标准 SQL 差别不大

支持子查询

支持 CTE(Common Table Expression 公用表表达式 with 子句)  
支持各种 JOIN， 但是 JOIN 操作无法使用缓存，所以即使是两次相同的 JOIN 语句，  
ClickHouse 也会视为两条新 SQL

窗口函数  
不支持自定义函数

GROUP BY 操作增加了 with rollup\with cube\with total 用来计算小计和总计。



数据准备：

```plain
insert into t_order_mt values (101,'sku_001',1000.00,'2020-06-01 12:00:00'),
(101,'sku_002',2000.00,'2020-06-01 12:00:00'),
(103,'sku_004',2500.00,'2020-06-01 12:00:00'),
(104,'sku_002',2000.00,'2020-06-01 12:00:00'),
(105,'sku_003',600.00,'2020-06-02 12:00:00'),
(106,'sku_001',1000.00,'2020-06-04 12:00:00'),
(107,'sku_002',2000.00,'2020-06-04 12:00:00'),
(108,'sku_004',2500.00,'2020-06-04 12:00:00'),
(109,'sku_002',2000.00,'2020-06-04 12:00:00'),
(110,'sku_003',600.00,'2020-06-01 12:00:00');
```



1. with rollup：从右至左去掉维度进行小计

> select id , sku_id,sum(total_amount) from t_order_mt group by id,sku_id with rollup;
>

2. with cube : 从右至左去掉维度进行小计，再从左至右去掉维度进行小计

> select id , sku_id,sum(total_amount) from t_order_mt group by id,sku_id with cube;
>

3. with totals: 只计算合计

> select id , sku_id,sum(total_amount) from t_order_mt group by id,sku_id with totals;
>



#### alter 操作
同 MySQL 的修改字段基本一致

1）新增字段

> alter table tableName add column newcolname String after col1;
>



2）修改字段类型

> alter table tableName modify column newcolname String;
>



3）删除字段

> alter table tableName drop column newcolname;
>

#### 导出数据
> clickhouse-client --query "select * from t_order_mt where create_time='2020-06-01 12:00:00'" --format CSVWithNames>  
> /opt/module/data/rs1.csv
>



官方文档： [https://clickhouse.com/docs/zh/interfaces/formats](https://clickhouse.com/docs/zh/interfaces/formats)

### 副本
副本的目的主要是保障数据的高可用性，即使一台 ClickHouse 节点宕机，那么也可以从其他服务器获得相同的数据。

官方文档：[https://clickhouse.com/docs/en/engines/table-engines/mergetree-family/replication](https://clickhouse.com/docs/en/engines/table-engines/mergetree-family/replication)



<!-- 这是一张图片，ocr 内容为： -->
![](https://cdn.nlark.com/yuque/0/2025/png/23130638/1754987601619-3b592f23-7bcd-4cac-9777-4678e0c5991d.png)



#### 配置步骤
（1）启动 zookeeper 集群

（2）在 服务器 的/etc/clickhouse-server/config.d 目录下创建一个名为 metrika.xml

的配置文件,内容如下：

metrika.xml  文件内容如下：

```xml
<?xml version="1.0"?>
<yandex>
    <zookeeper-servers>
        <node>
            <host>192.168.152.150</host>

            <port>2181</port>

        </node>

    </zookeeper-servers>

</yandex>

```

如果要使用该配置文件 我们需要修改confug.xml文件：

```xml
开启我们metrika.xml中的zk属性标签
<zookeeper incl="zookeeper-servers" optional="true" />
引入我们的配置文件路径（如果是docker容器，配置docker的文件路径）
<include_from>/etc/clickhouse-server/metrika.xml</include_from>

副本同步的接口 需要配置
<interserver_http_port>9009</interserver_http_port>

指定本机的ip，不配置的话 zk可能发现不了
<interserver_http_host>192.168.152.150</interserver_http_host>

配置时区
<timezone>Asia/Shanghai</timezone>

```





> 注意文件创建后的用户名：
>
> 执行命令： chown clickhouse:clickhouse metrika.xml
>



编辑 config.xml文件

> 添加我们指定的的zk配置文件  
> (引入这一行才能开启外部文件配置)  
> /etc/clickhouse-server/config.d/metrika.xml
>



注：也可以不创建外部文件，直接在 config.xml 中指定

因为修改了配置文件，如果以前启动了服务需要重启

#### 新的版本集群
> 1. 在每台clickhouse中加入一下配置
>
>   remote_servers：集群相关
>
>   zookeeper：zookeeper相关配置 可配置多个node 
>

```xml
<remote_servers>
        <!-- Test only shard config for testing distributed storage -->
        <chainmaker_clusters>
            <shard>
                <!-- Optional. Whether to write data to just one of the replicas. Default: false (write data to all replicas). -->
                <!-- <internal_replication>false</internal_replication> -->
                <!-- Optional. Shard weight when writing data. Default: 1. -->
                <!-- <weight>1</weight> -->
                <replica>
                    <host>192.168.152.150</host>

                    <port>9000</port>

                </replica>

            </shard>

            <shard>
                <replica>
                    <host>192.168.152.151</host>

                    <port>9000</port>

                </replica>

            </shard>

        </chainmaker_clusters>

    </remote_servers>

    <zookeeper>
        <node>
            <host>192.168.152.150</host>

            <port>2181</port>

        </node>

    </zookeeper>

    <timezone>Asia/Shanghai</timezone>

```





注意：  
副本的操作只对合并树家族有效

副本只能同步数据，不能同步表结构，所以我们需要在每台机器上自己手动建表

```plain
create table t_order_rep2 ( id UInt32,
sku_id String,
total_amount Decimal(16,2), create_time Datetime
) engine =ReplicatedMergeTree('/clickhouse/table/01/t_order_rep','rep_102') partition by toYYYYMMDD(create_time)
primary key (id) order by (id,sku_id);

create table t_order_rep2 ( id UInt32,
sku_id String,
total_amount Decimal(16,2), create_time Datetime
) engine =ReplicatedMergeTree('/clickhouse/table/01/t_order_rep','rep_103') partition by toYYYYMMDD(create_time)
primary key (id) order by (id,sku_id);

一台插入
insert into t_order_rep2 values (101,'sku_001',1000.00,'2020-06-01 12:00:00'),
(102,'sku_002',2000.00,'2020-06-01 12:00:00'),
(103,'sku_004',2500.00,'2020-06-01 12:00:00'),
(104,'sku_002',2000.00,'2020-06-01 12:00:00'),
(105,'sku_003',600.00,'2020-06-02 12:00:00');

一台查询
```



**参数解释**

ReplicatedMergeTree 中，

第一个参数是分片的 zk_path 一般按照： /clickhouse/table/{shard}/{table_name} 的格式写，如果只有一个分片就写 01 即可。

第二个参数是副本名称，相同的分片副本名称不能相同。

### 分片集群
副本虽然能够提高数据的可用性，降低丢失风险，但是每台服务器实际上必须容纳全量数据，对数据的横向扩容没有解决。  
要解决数据水平切分的问题，需要引入分片的概念。通过分片把一份完整的数据进行切分，不同的分片分布到不同的节点上，再通过 Distributed 表引擎把数据拼接起来一同使用。  
Distributed 表引擎本身不存储数据，有点类似于 MyCat 之于 MySql，成为一种中间件，通过分布式逻辑表来写入、分发、路由来操作多台节点不同分片的分布式数据。

注意：ClickHouse 的集群是表级别的，实际企业中，大部分做了高可用，但是没有用分片，避免降低查询性能以及操作集群的复杂性。

#### 集群写入流程
（3 分片 2 副本共 6 个节点）

<!-- 这是一张图片，ocr 内容为： -->
![](https://cdn.nlark.com/yuque/0/2025/png/23130638/1754987601666-b49cafd0-af09-4ce8-9a3c-b1ee2854926b.png)

#### 集群读取流程
（3 分片 2 副本共 6 个节点）

<!-- 这是一张图片，ocr 内容为： -->
![](https://cdn.nlark.com/yuque/0/2025/png/23130638/1754987601754-240ab0b8-6b25-4a29-846a-7d77ccec072d.png)







#### 分片集群配置（供参考）
（3 分片 2 副本共 6 个节点）

配置的位置还是在之前的/etc/clickhouse-server/config.d/metrika.xml，内容如下

    <font style="background-color:#f3bb2f;">注：也可以不创建外部文件，直接在 config.xml 的</font><font style="background-color:#f3bb2f;">中指定</font>

```xml
    <yandex>
        <remote_servers>
            <gmall_cluster> <!-- 集群名称-->
                <shard> <!--集群的第一个分片-->
                    <internal_replication>true</internal_replication>

                    <!--该分片的第一个副本-->
                    <replica>
                        <host>hadoop101</host>

                        <port>9000</port>

                    </replica>

                    <!--该分片的第二个副本-->
                    <replica>
                        <host>hadoop102</host>

                        <port>9000</port>

                    </replica>

                </shard>

                <shard> <!--集群的第二个分片-->
                    <internal_replication>true</internal_replication>

                    <replica>	<!--该分片的第一个副本-->
                        <host>hadoop103</host>

                        <port>9000</port>

                    </replica>

                    <replica>	<!--该分片的第二个副本-->
                        <host>hadoop104</host>

                        <port>9000</port>

                    </replica>

                </shard>

                <shard> <!--集群的第三个分片-->
                    <internal_replication>true</internal_replication>

                    <replica>	<!--该分片的第一个副本-->
                        <host>hadoop105</host>

                        <port>9000</port>

                    </replica>

                    <replica>	<!--该分片的第二个副本-->
                        <host>hadoop106</host>

                        <port>9000</port>

                    </replica>

                </shard>

            </gmall_cluster>

        </remote_servers>

    </yandex>

```





#### 配置三节点版本集群及副本
##### 集群及副本规划
（2个分片，只有第一个分片有副本）



<!-- 这是一张图片，ocr 内容为： -->
![](https://cdn.nlark.com/yuque/0/2025/png/23130638/1754987601829-0af6c076-daa5-445f-9373-0798fc6122bf.png)



hadoop102:

```xml
 <macros>
   <shard>01</shard>

   <replica>rep_1_1</replica>

</macros>

```

hadoop103:

```xml
<macros>
  <shard>01</shard>

  <replica>rep_1_2</replica>

</macros>

```

hadoop104:

```xml
 <macros>
   <shard>02</shard>

   <replica>rep_2_1</replica>

</macros
```



##### 配置步骤
1）在 hadoop102 的/etc/clickhouse-server/config.d 目录下创建 metrika-shard.xml 文件

注：也可以不创建外部文件，直接在 config.xml 的中指定

```xml
    <?xml version="1.0"?>
    <yandex>
        <remote_servers>
            <gmall_cluster> <!-- 集群名称-->
                <shard>	<!--集群的第一个分片-->
                    <internal_replication>true</internal_replication>

                    <replica>	<!--该分片的第一个副本-->
                        <host>hadoop102</host>

                        <port>9000</port>

                    </replica>

                    <replica>	<!--该分片的第二个副本-->
                        <host>hadoop103</host>

                        <port>9000</port>

                    </replica>

                </shard>

                <shard> <!--集群的第二个分片-->
                    <internal_replication>true</internal_replication>

                    <replica>	<!--该分片的第一个副本-->
                        <host>hadoop104</host>

                        <port>9000</port>

                    </replica>

                </shard>

            </gmall_cluster>

        </remote_servers>

        <zookeeper-servers>
            <node index="1">
                <host>hadoop102</host>

                <port>2181</port>

            </node>

            <node index="2">
                <host>hadoop103</host>

                <port>2181</port>

            </node>

            <node index="3">
                <host>hadoop104</host>

                <port>2181</port>

            </node>

        </zookeeper-servers>

        <macros>
            <shard>01</shard> <!--不同机器放的分片数不一样-->
            <replica>rep_1_1</replica> <!--不同机器放的副本数不一样-->
        </macros>

    </yandex>

```



2）将 hadoop102 的 metrika-shard.xml 同步到 103 和 104



3）修改 103 和 104 中 metrika-shard.xml 宏的配置

（1）103：

> sudo vim /etc/clickhouse-server/config.d/metrika-shard.xml
>
> 01
>

>  rep_1_2
>




（2）104

> sudo vim /etc/clickhouse-server/config.d/metrika-shard.xml
>
> 02
>

>   rep_2_1
>

> </macros
>



4）在 hadoop102 上修改/etc/clickhouse-server/config.xml

> 
>

>  /etc/clickhouse-server/config.d/metrika-shard.xml
>



5）同步/etc/clickhouse-server/config.xml 到 103 和 104

6）重启三台服务器上的 ClickHouse 服务

> sudo clickhouse restart
>

7）在 hadoop102 上执行建表语句

+ 会自动同步到 hadoop103 和 hadoop104 上
+ 集群名字要和配置文件中的一致
+ 分片和副本名称从配置文件的宏定义中获取



```plain
create table st_order_mt on cluster lmz_cluster ( id UInt32,
sku_id String,
total_amount Decimal(16,2), create_time Datetime
) engine
=ReplicatedMergeTree('/clickhouse/tables/{shard}/st_order_mt','{replica}') partition by toYYYYMMDD(create_time)
primary key (id) order by (id,sku_id);
```

<font style="background-color:#f3bb2f;">可以到 hadoop103 和 hadoop104 上查看表是否创建成功</font>



8）在 hadoop102 上创建 Distribute 分布式表

```plain
create table st_order_mt_all2 on cluster lmz_cluster (
id UInt32,sku_id String,
total_amount Decimal(16,2), create_time Datetime
)engine = Distributed(lmz_cluster,default, st_order_mt,hiveHash(sku_id));
```

参数含义：

+ Distributed（集群名称，库名，本地表名，分片键）
+ 分片键必须是整型数字，所以用 hiveHash 函数转换，也可以 rand()



9）在 hadoop102 上插入测试数据

```sql
insert into st_order_mt_all2 values (201,'sku_001',1000.00,'2020-06-01 12:00:00') ,
(202,'sku_002',2000.00,'2020-06-01 12:00:00'),
(203,'sku_004',2500.00,'2020-06-01 12:00:00'),
(204,'sku_002',2000.00,'2020-06-01 12:00:00'),
(205,'sku_003',600.00,'2020-06-02 12:00:00');
```

10）通过查询分布式表和本地表观察输出结果

（1）分布式表

> SELECT * FROM st_order_mt_all;
>

（2）本地表

> select * from st_order_mt;
>

（3）观察数据的分布



## ClickHouse进阶
### Explain 查看执行计划
> 在 clickhouse 20.6 版本之前要查看 SQL 语句的执行计划需要设置日志级别为 trace 才能可以看到，并且只能真正执行 sql，在执行日志里面查看。
>
> 在 20.6 版本引入了原生的执行计划的语法。在 20.6.3 版本成为正式版本的功能。
>



### 基本语法
> EXPLAIN [AST | SYNTAX | PLAN | PIPELINE][setting = value, ...] SELECT ... [FORMAT ...]
>
> + PLAN：用于查看执行计划，默认值。
> + header打印计划中各个步骤的 head 说明，默认关闭，默认值 0;
> + description打印计划中各个步骤的描述，默认开启，默认值 1；
> + actions打印计划中各个步骤的详细信息，默认关闭，默认值 0。
> + AST ：用于查看语法树;
> + SYNTAX：用于优化语法;
> + PIPELINE：用于查看 PIPELINE 计划。
> + header打印计划中各个步骤的 head 说明，默认关闭;
> + graph用 DOT 图形语言描述管道图，默认关闭，需要查看相关的图形需要配合graphviz 查看；
> + actions如果开启了 graph，紧凑打印打，默认开启。
>
> <font style="background-color:#f3bb2f;">注：PLAN 和 PIPELINE 还可以进行额外的显示设置，如上参数所示</font>
>



### 案例实操
1. 查看 PLAIN

```sql
--简单查询
explain plan select arrayJoin([1,2,3,null,null]);
--复杂 SQL 的执行计划
explain select database,table,count(1) cnt from system.parts where database in ('datasets','system') group by database,table order by database,cnt desc limit 2 by database;
--打开全部的参数的执行计划
EXPLAIN header=1, actions=1,description=1 SELECT number from system.numbers limit 10;
```

2. AST 语法树

```sql
EXPLAIN AST SELECT number from system.numbers limit 10;
```

3. SYNTAX 语法优化

```sql
--先做一次查询
SELECT number = 1 ? 'hello' : (number = 2 ? 'world' : 'atguigu') FROM numbers(10);
--查看语法优化
EXPLAIN SYNTAX SELECT number = 1 ? 'hello' : (number = 2 ? 'world' : 'atguigu') FROM numbers(10);

--开启三元运算符优化
SET optimize_if_chain_to_multiif = 1;
--再次查看语法优化
EXPLAIN SYNTAX SELECT number = 1 ? 'hello' : (number = 2 ? 'world' : 'atguigu') FROM numbers(10);

--返回优化后的语句
SELECT multiIf(number = 1, \'hello\', number = 2, \'world\', \'xyz\') FROM numbers(10)
```





4. 查看 PIPELINE

```sql
EXPLAIN PIPELINE SELECT sum(number) FROM numbers_mt(100000) GROUP BY number % 20;

--打开其他参数
EXPLAIN PIPELINE header=1,graph=1 SELECT sum(number) FROM numbers_mt(10000) GROUP BY number%20;
```







### 建表优化
#### 时间字段的类型
> 建表时能用数值型或日期时间型表示的字段就不要用字符串。
>
> 虽然 ClickHouse 底层将 DateTime 存储为时间戳 Long 类型，但不建议存储 Long 类型，因为 DateTime 不需要经过函数转换处理，执行效率高、可读性好。
>

```sql
create table t_type2( id UInt32,
sku_id String,
total_amount Decimal(16,2) , create_time Int32
) engine =ReplacingMergeTree(create_time)
partition by toYYYYMMDD(toDate(create_time)) –-需要转换一次，否则报错
primary key (id)
```



#### 空值存储类型
> 官方已经指出 Nullable 类型几乎总是会拖累性能，因为存储 Nullable 列时需要创建一个额外的文件来存储 NULL 的标记，并且 Nullable 列无法被索引。因此除非极特殊情况，应直接使用字段默认值表示空，或者自行指定一个在业务中无意义的值（例如用-1 表示没有商品 ID）。
>

```sql
CREATE TABLE t_null(x Int8, y Nullable(Int8)) ENGINE TinyLog; INSERT INTO t_null VALUES (1, NULL), (2, 3);
SELECT x + y FROM t_null;
```

查看存储的文件: 会发现除了对应的字段文件，还会有一个null.bin的文件生成。

官网说明：[https://clickhouse.com/docs/zh/sql-reference/data-types/nullable/](https://clickhouse.com/docs/zh/sql-reference/data-types/nullable/)

#### 分区和索引
> 分区粒度根据业务特点决定，不宜过粗或过细。
>
> 一般选择按天分区，也可以指定为 Tuple()，以单表一亿数据为例，分区大小控制在 10-30 个为最佳。  
> 必须指定索引列，ClickHouse 中的索引列即排序列，通过 order by 指定，一般在查询条件中经常被用来充当筛选条件的属性被纳入进来；
>
> 可以是单一维度，也可以是组合维度的索引；通常需要满足高级列在前、查询频率大的在前原则；还有基数特别大的不适合做索引列，如用户表的 userid 字段；通常筛选后的数据满足在百万以内为最佳。
>



#### 表参数
> ndex_granularity 是用来控制索引粒度的，默认是 8192，如非必须不建议调整。
>
> 如果表中不是必须保留全量历史数据，建议指定 TTL（生存时间值），可以免去手动过期历史数据的麻烦，TTL 也可以通过 alter table 语句随时修改。（参考基础文档的数据TTL）
>



#### 写入和删除优化
> （1）尽量不要执行单条或小批量删除和插入操作，这样会产生小分区文件，给后台
>
> Merge 任务带来巨大压力
>
> （2）不要一次写入太多分区，或数据写入太快，数据写入太快会导致 Merge 速度跟不上而报错，一般建议每秒钟发起 2-3 次写入操作，每次操作写入 2w~5w 条数据（依服务器性能而定）
>



写入过快报错，报错信息：

```latex
1.Code: 252, e.displayText() = DB::Exception: Too many parts(304). Merges are processing significantly slower than inserts
2.Code: 241, e.displayText() = DB::Exception: Memory limit (for query) exceeded:would use 9.37 GiB (attempt to allocate chunk of 301989888 bytes), maximum: 9.31 GiB
```

**处理方式：**

+ Too many parts 处理：使用 WAL 预写日志，提高写入性能。
+ in_memory_parts_enable_wal 默认为 true
+ 在服务器内存充裕的情况下增加内存配额，一般通过 max_memory_usage 来实现
+ 在服务器内存不充裕的情况下，建议将超出部分内容分配到系统硬盘上，但会降低执行速度，一般通过max_bytes_before_external_group_by、max_bytes_before_external_sort 参数来实现。



#### 常见配置
配置项主要在 config.xml 或 users.xml 中， 基本上都在 users.xml 里

config.xml 的配置项  
[https://clickhouse.com/docs/en/operations/server-configuration-parameters/settings/](https://clickhouse.com/docs/en/operations/server-configuration-parameters/settings/)

users.xml 的配置项  
[https://clickhouse.com/docs/en/operations/settings/settings/](https://clickhouse.com/docs/en/operations/settings/settings/)



1. CPU 资源

| 配置 | 描述 |
| --- | :--- |
| background_pool_sizex | 后台线程池的大小， merge 线程就是在该线程池中执行，    该线程池不仅仅是给 merge 线程用的，默认值 16，允许的前提下建议改成 c pu 个数的 2 倍（ 线程数）。 |
| background_schedule_pool_size | 执行后台任务（ 复制表、Kafka 流、DNS 缓存更新） 的线程数。   默认 128， 建议改成 cpu 个数的 2 倍（线程数）。 |
| background_distributed_schedule_ pool_size | 设置为分布式发送执行后台任务的线程数， 默认 16， 建议改成 cpu个数的 2 倍（ 线程数） |
| max_concurrent_queries | 最大并发处理的请求数(包含 select,insert 等)，默认值 100，推荐 150(不够再加)~300 |
| max_threads | 设置单个查询所能使用的最大 cpu 个数，默认是 cpu 核数 |


2. 内存资源

| 配置 | 描述 |
| --- | :--- |
| max_memory_usage | 此参数在 users.xml  中,表示单次 Query 占用内存最大值， 该值可以设置的比较大， 这样可以提升集群查询的上限。保留一点给 OS， 比如 128G 内存的机器， 设置为 100GB。 |
| max_bytes_before_external_group_by | 一般按照 max_memory_usage 的一半设置内存，当 group 使用内存超过阈值后会刷新到磁盘进行。因为 clickhouse 聚合分两个阶段：查询并及建立中间数据、合并中间数据， 结合上一项， 建议 50GB |
| max_table_size_to_drop | 当 order  by 已使用 max_bytes_before_external_sort 内存就进行溢写磁盘(基于磁盘排序)，如果不设置该值，那么当内存不够时直接抛错，设置了该值 order by 可以正常完成，但是速度相对存内存来说肯定要慢点(实测慢的非常多， 无法接受)。 |
| max_bytes_before_external_sort | 此参数在 config.xml 中，应用于需要删除表或分区的情况，默认是50GB，意思是如果删除 50GB 以上的分区表会失败。建议修改为 0，这样不管多大的分区表都可以删除。 |


#### 存储
> ClickHouse 不支持设置多数据目录，为了提升数据 io 性能，可以挂载虚拟券组
>
> 一个券组绑定多块物理磁盘提升读写性能，多数据查询场景 SSD 会比普通机械硬盘快 2-3 倍。
>

### ClickHouse 语法优化规则
#### COUNT 优化
#### 消除子查询重复字段
#### 谓词下推
#### 聚合计算外推
#### 聚合函数消除
#### 删除重复的 order by key
#### 删除重复的 limit by key
#### 删除重复的 USING Key
#### 标量替换
#### 三元运算优化
### 查询优化
#### 单表查询
#### Prewhere 替代 where
#### 数据采样
#### 列裁剪与分区裁剪
#### orderby 结合 where、limit
#### 避免构建虚拟列
#### uniqCombined 替代 distinct
#### 使用物化视图
#### 其他注意事项
### 多表关联
#### 准备表和数据
#### 用 IN 代替 JOIN
#### 大小表 JOIN
#### 注意谓词下推
#### 分布式表使用 GLOBAL
#### 使用字典表
#### 提前过滤
### 数据一致性（重点）
### 物化视图
### MaterializeMySQL 引擎
## 监控及备份
### ClickHouse 监控概述
### Prometheus&Grafana的安装
### Prometheus安装
### Grafana安装
### ClickHouse 配置
### Grafana集成Prometheus
### 备份及恢复
```plain

```

