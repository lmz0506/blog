---
layout: doc
title: python脚本-Maven私库依赖上传
category: 工具
date: '2026-02-27'
tags:
  - python
  - maven
  - nexus
---
<details class="lake-collapse"><summary id="u203bd272"><span class="ne-text">python脚本</span></summary><pre data-language="java" id="itxNd" class="ne-codeblock language-java"><code>#!/usr/bin/env python3
import os
import sys
import subprocess
import tempfile
import xml.etree.ElementTree as ET
from pathlib import Path

## ================== 配置区 ==================
NEXUS_URL = &quot;http://192.168.23.150:12600/repository/maven-releases/&quot;
NEXUS_URL_SNAPSHOTS = &quot;http://192.168.23.150:12600/repository/maven-snapshots/&quot;
USERNAME = &quot;admin&quot;
PASSWORD = &quot;admin123&quot;

## 仓库 ID 配置
RELEASE_REPOSITORY_ID = &quot;nexus-release&quot;
SNAPSHOT_REPOSITORY_ID = &quot;nexus-snapshot&quot;

LOCAL_REPO = Path(
    r&quot;G:\畅享\项目\医保驾驶舱\文档\taobao\taobao\parent&quot;)
LOG_FILE = &quot;upload_log.txt&quot;
ERROR_FILE = &quot;upload_errors.txt&quot;  # 添加错误文件路径
LOG_FILE_ERROR = &quot;./upload_errors_back.txt&quot;


## ==========================================
def parse_gav_from_pom(pom_path):
    &quot;&quot;&quot;从 pom.xml 中提取 groupId, artifactId, version&quot;&quot;&quot;
    try:
        tree = ET.parse(pom_path)
        root = tree.getroot()
        ns = {'m': 'http://maven.apache.org/POM/4.0.0'} if root.tag.startswith('{') else {}

        def get_text_or_parent(tag):
            elem = root.find(f'm:{tag}', ns)
            if elem is not None:
                return elem.text
            # 尝试从 parent 继承（简单处理，不递归）
            parent = root.find('m:parent', ns)
            if parent is not None:
                elem = parent.find(f'm:{tag}', ns)
                if elem is not None:
                    return elem.text
            return None

        def resolve_properties(text, properties_dict):
            &quot;&quot;&quot;解析属性占位符&quot;&quot;&quot;
            if text and '${' in text:
                for prop_name, prop_value in properties_dict.items():
                    placeholder = f&quot;${{{prop_name}}}&quot;
                    if placeholder in text:
                        text = text.replace(placeholder, prop_value)
            return text

        def get_properties_from_pom(pom_root):
            &quot;&quot;&quot;获取 POM 中定义的属性&quot;&quot;&quot;
            properties = {}
            properties_elem = pom_root.find('m:properties', ns)
            if properties_elem is not None:
                for prop in properties_elem:
                    prop_name = prop.tag.replace(f&quot;{{{list(ns.values())[0]}}}&quot;, &quot;&quot;)
                    properties[prop_name] = prop.text or &quot;&quot;
            return properties

        # 获取当前 POM 的属性
        current_properties = get_properties_from_pom(root)

        group_id = get_text_or_parent('groupId')
        artifact_id = get_text_or_parent('artifactId')
        version = get_text_or_parent('version')

        # 先尝试解析当前 POM 中定义的属性
        if current_properties:
            group_id = resolve_properties(group_id, current_properties) if group_id else None
            artifact_id = resolve_properties(artifact_id, current_properties) if artifact_id else None
            version = resolve_properties(version, current_properties) if version else None

        # 如果版本仍然是占位符，检查父 POM 中是否有实际版本
        if version and '${' in version:
            parent = root.find('m:parent', ns)
            if parent is not None:
                parent_version_elem = parent.find('m:version', ns)
                if parent_version_elem is not None and parent_version_elem.text and '${' not in parent_version_elem.text:
                    # 使用父 POM 中的实际版本
                    version = parent_version_elem.text

        if not all([group_id, artifact_id, version]):
            return None

        # 最终检查版本是否仍包含占位符
        if version and '${' in version:
            print(f&quot;  ⚠️ 版本包含未解析的属性: {version}&quot;)
            return None

        return group_id.strip(), artifact_id.strip(), version.strip()
    except Exception as e:
        print(f&quot;  ❌ 解析 POM 失败: {e}&quot;)
        return None


def run_mvn_deploy(gav, files_info):
    group_id, artifact_id, version = gav
    packaging = files_info.get(&quot;packaging&quot;, &quot;jar&quot;)

    # 根据版本是否包含 SNAPSHOT 选择不同的 URL 和 repositoryId
    if &quot;SNAPSHOT&quot; in version.upper():
        url = NEXUS_URL_SNAPSHOTS
        repository_id = SNAPSHOT_REPOSITORY_ID
    else:
        url = NEXUS_URL
        repository_id = RELEASE_REPOSITORY_ID

    # 构建 mvn 命令
    cmd = [
        &quot;mvn&quot;, &quot;deploy:deploy-file&quot;,
        f&quot;-DgroupId={group_id}&quot;,
        f&quot;-DartifactId={artifact_id}&quot;,
        f&quot;-Dversion={version}&quot;,
        f&quot;-Dpackaging={packaging}&quot;,
        f&quot;-DrepositoryId={repository_id}&quot;,  # 使用根据版本类型选择的 repositoryId
        f&quot;-Durl={url}&quot;  # 使用根据版本类型选择的 URL
    ]

    if packaging == &quot;pom&quot;:
        cmd.append(f&quot;-Dfile={files_info['pom']}&quot;)
        cmd.append(f&quot;-DpomFile={files_info['pom']}&quot;)
    else:
        cmd.extend([
            f&quot;-Dfile={files_info['main']}&quot;,
            f&quot;-DpomFile={files_info['pom']}&quot;
        ])

    # 附加 sources/javadoc（如果存在）
    classifiers = []
    types = []
    files = []

    if &quot;sources&quot; in files_info:
        classifiers.append(&quot;sources&quot;)
        types.append(&quot;jar&quot;)
        files.append(files_info[&quot;sources&quot;])
    if &quot;javadoc&quot; in files_info:
        classifiers.append(&quot;javadoc&quot;)
        types.append(&quot;jar&quot;)
        files.append(files_info[&quot;javadoc&quot;])

    if classifiers:
        cmd.append(f&quot;-Dfiles={','.join(files)}&quot;)
        cmd.append(f&quot;-Dclassifiers={','.join(classifiers)}&quot;)
        cmd.append(f&quot;-Dtypes={','.join(types)}&quot;)

    # 设置 settings 文件路径
    settings_path = r'E:\maven\apache-maven-3.6.0-bin\apache-maven-3.6.0\conf\dev2.xml'
    cmd.append(f&quot;-s&quot;)
    cmd.append(settings_path)
    # 打印命令
    print(&quot; &quot;.join(cmd))
    # 执行命令，保留 cwd 参数以确保在正确的目录下执行
    result = subprocess.run(cmd, capture_output=True, text=True, cwd=os.path.dirname(files_info['pom']), shell=True)
    if result.returncode == 0:
        return True, &quot; &quot;.join(cmd), &quot; &quot;
    else:
        return False, &quot; &quot;.join(cmd), result.stderr or result.stdout


def get_files_info(pom_path, gav):
    &quot;&quot;&quot;获取要上传的文件信息&quot;&quot;&quot;
    group_id, artifact_id, version = gav
    base_name = f&quot;{artifact_id}-{version}&quot;
    base_dir = pom_path.parent

    # 检查所有可能的文件
    jar_path = base_dir / f&quot;{base_name}.jar&quot;
    sources_path = base_dir / f&quot;{base_name}-sources.jar&quot;
    javadoc_path = base_dir / f&quot;{base_name}-javadoc.jar&quot;

    # 如果存在 JAR 文件，优先上传 JAR 包（包含 POM 作为描述文件）
    if jar_path.exists():
        files_info = {
            &quot;packaging&quot;: &quot;jar&quot;,
            &quot;main&quot;: str(jar_path),
            &quot;pom&quot;: str(pom_path)
        }

        # 检查并添加 sources 和 javadoc
        if sources_path.exists():
            files_info[&quot;sources&quot;] = str(sources_path)
        if javadoc_path.exists():
            files_info[&quot;javadoc&quot;] = str(javadoc_path)
    else:
        # 仅上传 POM 文件
        files_info = {
            &quot;packaging&quot;: &quot;pom&quot;,
            &quot;pom&quot;: str(pom_path)
        }

    return files_info


def main(enable_error_log=False, log_file: str = LOG_FILE_ERROR):
    pom_files = []
    if enable_error_log:
        print(f&quot;  ⚠️ 错误依赖重跑========================&quot;)
        # 获取错误文件中的POM路径
        with open(log_file, &quot;r&quot;, encoding=&quot;utf-8&quot;) as error_file:
            error_lines = error_file.readlines()
        # 解析错误文件，获取需要重跑的POM文件路径

        for line in error_lines:
            line = line.strip()
            if line.endswith('.pom') and os.path.exists(line):
                pom_files.append(Path(line))

    else:
        pom_files = list(LOCAL_REPO.rglob(&quot;*.pom&quot;))
    total = len(pom_files)
    success_count = 0
    fail_count = 0

    # 清空错误文件
    with open(ERROR_FILE, &quot;w&quot;, encoding=&quot;utf-8&quot;) as error_log:
        error_log.write(&quot;失败的上传记录:\n&quot;)
        error_log.write(&quot;=&quot; * 50 + &quot;\n&quot;)

    with open(LOG_FILE, &quot;w&quot;, encoding=&quot;utf-8&quot;) as log:
        for i, pom_path in enumerate(pom_files, 1):
            print(f&quot;[{i}/{total}] 处理: {pom_path.relative_to(LOCAL_REPO)}&quot;)
            log.write(f&quot;Processing: {pom_path}\n&quot;)

            gav = parse_gav_from_pom(pom_path)
            if not gav:
                msg = &quot;  ⚠️ 无法解析 GAV，跳过\n&quot;
                print(msg.strip())
                log.write(msg)

                # 记录到错误文件
                with open(ERROR_FILE, &quot;a&quot;, encoding=&quot;utf-8&quot;) as error_log:
                    error_log.write(f&quot;{pom_path}\n&quot;)

                fail_count += 1
                continue

            files_info = get_files_info(pom_path, gav)

            # 验证必要的文件是否存在
            if &quot;main&quot; in files_info:
                main_file_path = Path(files_info[&quot;main&quot;])
                if not main_file_path.exists():
                    msg = f&quot;  ❌ 主文件不存在: {main_file_path}\n&quot;
                    print(msg.strip())
                    log.write(msg)

                    # 记录到错误文件
                    with open(ERROR_FILE, &quot;a&quot;, encoding=&quot;utf-8&quot;) as error_log:
                        error_log.write(f&quot;{pom_path}\n&quot;)

                    fail_count += 1
                    continue

            success, cmdStr, error_msg = run_mvn_deploy(gav, files_info)
            if success:
                msg = f&quot;  ✅ 成功: {':'.join(gav)}\n&quot;
                print(msg.strip())
                log.write(&quot;\n&quot;+msg + &quot;\n&quot; + cmdStr+&quot;\n&quot;)
                success_count += 1
            else:
                msg = f&quot;  ❌ 失败: {':'.join(gav)}\n      错误: {error_msg[:500]}\n&quot;
                print(msg.strip())
                log.write(&quot;\n&quot;+msg + &quot;\n&quot; + cmdStr+&quot;\n&quot;)
                # 将失败记录写入错误文件
                with open(ERROR_FILE, &quot;a&quot;, encoding=&quot;utf-8&quot;) as error_log:
                    error_log.write(f&quot;{pom_path}\n&quot;)

                fail_count += 1

    print(&quot;\n&quot; + &quot;=&quot; * 50)
    print(f&quot;完成！总计: {total}, 成功: {success_count}, 失败: {fail_count}&quot;)
    print(f&quot;详细日志见: {LOG_FILE}&quot;)
    print(f&quot;失败记录见: {ERROR_FILE}&quot;)




if __name__ == &quot;__main__&quot;:
    # 检查 mvn 是否可用
    try:
        subprocess.run([&quot;mvn&quot;, &quot;-v&quot;], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True, shell=True)
    except (subprocess.CalledProcessError, FileNotFoundError):
        print(&quot;错误：未找到 'mvn' 命令，请确保 Maven 已安装并加入 PATH。&quot;)
        sys.exit(1)

    main()
</code></pre></details>
<details class="lake-collapse"><summary id="ua8bf0ffc"><span class="ne-text">maven配置文件</span></summary><pre data-language="plain" id="Y4gtn" class="ne-codeblock language-plain"><code>&lt;!-- 本地仓库路径 --&gt;
&lt;localRepository&gt;E:\maven_location_ybjsc&lt;/localRepository&gt;

&lt;pluginGroups&gt;&lt;/pluginGroups&gt;

&lt;!-- 镜像配置 - 修改为镜像所有仓库 --&gt;
&lt;mirrors&gt;
    &lt;mirror&gt;
        &lt;id&gt;location-repo&lt;/id&gt;
        &lt;mirrorOf&gt;*&lt;/mirrorOf&gt; &lt;!-- 改为 * 镜像所有仓库，不只是 central --&gt;
        &lt;name&gt;location-repo&lt;/name&gt;
        &lt;url&gt;http://192.168.23.150:12600/repository/maven-public/&lt;/url&gt;
    &lt;/mirror&gt;
&lt;/mirrors&gt;

&lt;!-- 服务器认证信息 --&gt;
&lt;servers&gt;
    &lt;server&gt;
        &lt;id&gt;nexus-release&lt;/id&gt;
        &lt;username&gt;admin&lt;/username&gt;
        &lt;password&gt;admin123&lt;/password&gt;
    &lt;/server&gt;
    &lt;server&gt;
        &lt;id&gt;nexus-snapshot&lt;/id&gt;
        &lt;username&gt;admin&lt;/username&gt;
        &lt;password&gt;admin123&lt;/password&gt;
    &lt;/server&gt;
&lt;/servers&gt;

&lt;!-- Profile 配置 - 添加多个仓库源 --&gt;
&lt;profiles&gt;
    &lt;profile&gt;
        &lt;id&gt;dev&lt;/id&gt;
        &lt;repositories&gt;
            &lt;!-- 主要仓库：私有 Nexus 仓库 --&gt;
            &lt;repository&gt;
                &lt;id&gt;location-repo&lt;/id&gt;
                &lt;name&gt;location-repo&lt;/name&gt;
                &lt;url&gt;http://192.168.23.150:12600/repository/maven-public/&lt;/url&gt;
                &lt;releases&gt;
                    &lt;enabled&gt;true&lt;/enabled&gt;
                    &lt;updatePolicy&gt;daily&lt;/updatePolicy&gt;
                    &lt;checksumPolicy&gt;warn&lt;/checksumPolicy&gt;
                &lt;/releases&gt;
                &lt;snapshots&gt;
                    &lt;enabled&gt;true&lt;/enabled&gt;
                    &lt;updatePolicy&gt;daily&lt;/updatePolicy&gt;
                    &lt;checksumPolicy&gt;warn&lt;/checksumPolicy&gt;
                &lt;/snapshots&gt;
            &lt;/repository&gt;
            
            &lt;!-- 备用仓库：Maven 中央仓库 --&gt;
            &lt;repository&gt;
                &lt;id&gt;central&lt;/id&gt;
                &lt;name&gt;Maven Central&lt;/name&gt;
                &lt;url&gt;https://repo1.maven.org/maven2/&lt;/url&gt;
                &lt;releases&gt;
                    &lt;enabled&gt;true&lt;/enabled&gt;
                &lt;/releases&gt;
                &lt;snapshots&gt;
                    &lt;enabled&gt;false&lt;/enabled&gt;
                &lt;/snapshots&gt;
            &lt;/repository&gt;
            
            &lt;!-- 阿里云镜像作为备用 --&gt;
            &lt;repository&gt;
                &lt;id&gt;aliyun&lt;/id&gt;
                &lt;name&gt;Aliyun Repository&lt;/name&gt;
                &lt;url&gt;https://maven.aliyun.com/repository/public&lt;/url&gt;
                &lt;releases&gt;
                    &lt;enabled&gt;true&lt;/enabled&gt;
                &lt;/releases&gt;
                &lt;snapshots&gt;
                    &lt;enabled&gt;false&lt;/enabled&gt;
                &lt;/snapshots&gt;
            &lt;/repository&gt;
        &lt;/repositories&gt;
        
        &lt;pluginRepositories&gt;
            &lt;pluginRepository&gt;
                &lt;id&gt;location-repo&lt;/id&gt;
                &lt;name&gt;location-repo&lt;/name&gt;
                &lt;url&gt;http://192.168.23.150:12600/repository/maven-public/&lt;/url&gt;
                &lt;releases&gt;
                    &lt;enabled&gt;true&lt;/enabled&gt;
                    &lt;updatePolicy&gt;daily&lt;/updatePolicy&gt;
                    &lt;checksumPolicy&gt;warn&lt;/checksumPolicy&gt;
                &lt;/releases&gt;
                &lt;snapshots&gt;
                    &lt;enabled&gt;true&lt;/enabled&gt;
                    &lt;updatePolicy&gt;daily&lt;/updatePolicy&gt;
                    &lt;checksumPolicy&gt;warn&lt;/checksumPolicy&gt;
                &lt;/snapshots&gt;
            &lt;/pluginRepository&gt;
            
            &lt;!-- Maven 中央插件仓库 --&gt;
            &lt;pluginRepository&gt;
                &lt;id&gt;central&lt;/id&gt;
                &lt;name&gt;Maven Central Plugin Repository&lt;/name&gt;
                &lt;url&gt;https://repo1.maven.org/maven2/&lt;/url&gt;
                &lt;releases&gt;
                    &lt;enabled&gt;true&lt;/enabled&gt;
                &lt;/releases&gt;
                &lt;snapshots&gt;
                    &lt;enabled&gt;false&lt;/enabled&gt;
                &lt;/snapshots&gt;
            &lt;/pluginRepository&gt;
        &lt;/pluginRepositories&gt;
    &lt;/profile&gt;
&lt;/profiles&gt;

&lt;activeProfiles&gt;
    &lt;activeProfile&gt;dev&lt;/activeProfile&gt;
&lt;/activeProfiles&gt;</code></pre></details>
