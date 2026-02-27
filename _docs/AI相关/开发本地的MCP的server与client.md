---
layout: doc
title: 创建MCP服务器
category: AI相关
date: '2026-02-27'
tags:
  - MCP
---
## 使用fastMcp构建暴露我们的mcpServer
```python
from fastapi import FastAPI, Query
from fastapi_mcp import FastApiMCP
import uvicorn
from pydantic import BaseModel, Field

app = FastAPI()
# 创建MCP服务器
mcp = FastApiMCP(
    app,
    name="My API MCP",
    description="MCP server for the Item API",
    describe_full_response_schema=True,  # Describe the full response JSON-schema instead of just a response example
    describe_all_responses=True,  # Describe all the possible responses instead of just the success (2XX) response
)

mcp.mount(mount_path="/mcp")


# 定义一个用户模型
class User(BaseModel):
    userId: int = Field(None, description="用户ID")
    name: str = Field(..., description="用户姓名")
    age: int = Field(..., description="用户年龄")


userList = [
    User(userId=1, name="张三", age=30),
    User(userId=2, name="李四", age=28),
    User(userId=3, name="王五", age=35),
]


# 显式指定operation_id（工具将被命名为"get_user_info"）
@app.get("/getUserInfoByName/", operation_id="get_user_info", description="根据用户姓名获取用户信息", response_model=User)
async def read_user(user_name: str = Query(..., description="用户姓名")):
    """
    根据用户姓名获取用户信息
    """
    # 从userList中查找用户信息
    for user in userList:
        if user.name == user_name:
            return user
    return {"message": "User not found"}


@app.get("/getServerTime/", operation_id="get_server_time", description="获取服务器时间")
async def get_server_time():
    """
    获取服务器时间。
    """
    from datetime import datetime
    return datetime.now().isoformat()


@app.post("/addUser", operation_id="add_user", description="添加用户信息")
async def add_user(user: User):
    """
    添加用户信息。
    """
    user.userId = len(userList) + 1
    userList.append(user)
    # 模拟添加用户信息
    return user


mcp.setup_server()
if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=9003)

```



## 构建client
准备我们的promt

```latex
你是一个AI助手，可以帮助用户解决问题，包括但不限于编程、编辑文件、浏览网站等。

====

工具使用

你可以访问一组工具，这些工具会在用户批准后执行。
每条消息中只能使用一个工具，并且会在用户的响应中收到该工具使用的执行结果。
你会逐步使用工具来完成任务，每次工具的使用都基于前一次工具使用的结果进行决策。

# 工具使用格式

工具使用采用类似XML标签的方式进行格式化。
工具名称包含在起始和结束标签之间，每个参数也分别包含在其对应的标签之中。
结构如下：

<tool_name>
<parameter1_name>值1</parameter1_name>
<parameter2_name>值2</parameter2_name>
...
</tool_name>

例如：

<read_file>
<path>src/main.js</path>
</read_file>

请始终遵循这种格式以确保正确解析和执行。

# 工具
## use_mcp_tool
描述：请求使用由已连接的MCP服务器提供的工具。每个MCP服务器可以提供多个具有不同功能的工具。工具定义了输入模式，用于指定必填和可选参数。
参数：
- server_name: (必填) 提供工具的MCP服务器的名称
- tool_name: (必填) 要执行的工具名称
- arguments: (必填) 包含工具输入参数的JSON对象，需符合工具的输入模式
使用示例：
<use_mcp_tool>
<server_name>server name here</server_name>
<tool_name>tool name here</tool_name>
<arguments>
{
  "param1": "value1",
  "param2": "value2"
}
</arguments>
</use_mcp_tool>

# 工具使用示例
## 示例1：请求使用MCP工具

<use_mcp_tool>
<server_name>weather-server</server_name>
<tool_name>get_forecast</tool_name>
<arguments>
{
  "city": "旧金山",
  "days": 5
}
</arguments>
</use_mcp_tool>

## 示例2：另一个使用MCP工具的示例（其中服务器名称是像URL这样的唯一标识符）

<use_mcp_tool>
<server_name>github.com/modelcontextprotocol/servers/tree/main/src/github</server_name>
<tool_name>create_issue</tool_name>
<arguments>
{
  "owner": "octocat",
  "repo": "hello-world",
  "title": "发现了一个bug",
  "body": "我遇到了一个问题。",
  "labels": ["bug", "help wanted"],
  "assignees": ["octocat"]
}
</arguments>
</use_mcp_tool>

===

MCP服务器

模型上下文协议(MCP)使系统与本地运行的MCP服务器之间能够通信，MCP服务器提供了额外的工具和资源来扩展你的能力。

# 已连接的MCP服务器

当服务器连接成功后，你可以通过`use_mcp_tool`工具使用服务器上的工具，并通过`access_mcp_resource`工具访问服务器上的资源。
<$MCP_INFO$>

===

能力
- 你可以访问可能提供额外工具和资源的MCP服务器。每个服务器可能提供不同的能力，你可以利用这些能力更有效地完成任务。

====

规则
- MCP操作应像其他工具使用一样，一次只使用一个。在继续更多操作之前，请等待确认操作是否成功。

====

目标

你需要迭代地完成给定的任务，将其分解为清晰的步骤并有条不紊地执行它们。

1. 分析用户的任务，设定明确、可实现的目标来完成它。将这些目标按逻辑顺序优先排列。
2. 按顺序逐个完成这些目标，根据需要一次使用一个可用工具。每个目标都应该对应问题解决过程中的一个明确步骤。你会得知已完成的工作和剩余工作。
3. 一旦完成了用户的任务，你必须使用attempt_completion工具向用户展示任务结果。
4. 用户可能会提供反馈，你可以据此进行改进并再次尝试。但不要陷入无意义的来回对话中，即回答不要以问题或进一步帮助的提议结尾。
```



准备我们的client代码

```python
import asyncio
from typing import Optional
from contextlib import AsyncExitStack
import json

from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client
from mcp.client.sse import sse_client

from dotenv import load_dotenv
import os, re
from openai import OpenAI
from lxml import etree


class MCPClient:
    def __init__(self):
        # Initialize session and client objects
        self.session: Optional[ClientSession] = None
        self.exit_stack = AsyncExitStack()
        # 需要提前在.env文件中设置相关环境变量
        self.API_KEY = 'sk-ab6b03a315274b62b7521ee304cd672a'
        self.BASE_URL = 'https://dashscope.aliyuncs.com/compatible-mode/v1/'
        self.MODEL = 'qwen-plus'
        # 创建LLM client
        self.client = OpenAI(api_key=self.API_KEY, base_url=self.BASE_URL)
        # 存储历史消息
        self.messages = []
        # 读取提示词模板
        with open("./MCP_Prompt.txt", "r", encoding="utf-8") as file:
            self.system_prompt = file.read()

    async def connect_to_sse_server(self, mcp_name, server_url: str):
        stdio_transport = await self.exit_stack.enter_async_context(sse_client(server_url))
        self.sse, self.write = stdio_transport
        self.session = await self.exit_stack.enter_async_context(ClientSession(self.sse, self.write))

        await self.session.initialize()
        # List available tools
        response = await self.session.list_tools()
        available_tools = [
            '##' + mcp_name + '\n### Available Tools\n- ' + tool.name + "\n" + tool.description + "\n" + json.dumps(
                tool.inputSchema, ensure_ascii=False) for tool in response.tools]
        self.system_prompt = self.system_prompt.replace("<$MCP_INFO$>", "\n".join(available_tools) + "\n<$MCP_INFO$>\n")
        tools = response.tools
        print(f"Successfully connected to {mcp_name} server with tools:", [tool.name for tool in tools])

    async def process_query(self, query: str) -> str:
        """Process a query using Claude and available tools"""
        self.messages.append(
            {
                "role": "system",
                "content": self.system_prompt
            }
        )
        self.messages.append(
            {
                "role": "user",
                "content": query
            }
        )

        # Initial Claude API call
        response = self.client.chat.completions.create(
            model=self.MODEL,
            max_tokens=1024,
            messages=self.messages,
        )

        # Process response and handle tool calls
        final_text = []
        content = response.choices[0].message.content
        if '<use_mcp_tool>' not in content:
            final_text.append(content)
        else:
            # 解析tool_string
            server_name, tool_name, tool_args = self.parse_tool_string(content)

            # 执行工具调用
            result = await self.session.call_tool(tool_name, tool_args)
            print(f"[Calling tool {tool_name} with args {tool_args}]")
            print("-" * 40)
            print("Server:", server_name)
            print("Tool:", tool_name)
            print("Args:", tool_args)
            print("-" * 40)
            print("Result:", result.content[0].text)
            print("-" * 40)
            self.messages.append({
                "role": "assistant",
                "content": content
            })
            self.messages.append({
                "role": "user",
                "content": f"[Tool {tool_name} \n returned: {result}]"
            })

            response = self.client.chat.completions.create(
                model=self.MODEL,
                max_tokens=1024,
                messages=self.messages
            )
            final_text.append(response.choices[0].message.content)
        return "\n".join(final_text)

    def parse_tool_string(self, tool_string: str) -> tuple[str, str, dict]:
        """
        解析大模型工具调用返回的字符串
        """
        tool_string = re.findall("(<use_mcp_tool>.*?</use_mcp_tool>)", tool_string, re.S)[0]
        root = etree.fromstring(tool_string)
        server_name = root.find('server_name').text
        tool_name = root.find('tool_name').text
        try:
            tool_args = json.loads(root.find('arguments').text)
        except json.JSONDecodeError:
            raise ValueError("Invalid tool arguments")
        return server_name, tool_name, tool_args

    async def chat_loop(self):
        """Run an interactive chat loop"""
        print("\nMCP Client Started!")
        print("Type your queries or 'quit' to exit.")
        self.messages = []
        while True:
            try:
                query = input("\nQuery: ").strip()

                if query.lower() == 'quit':
                    break
                if query.strip() == '':
                    print("Please enter a query.")
                    continue
                response = await self.process_query(query)
                print(response)

            except Exception as e:
                print(f"\nError: {str(e)}")

    async def cleanup(self):
        """Clean up resources"""
        await self.exit_stack.aclose()


async def main():
    client = MCPClient()
    try:
        await client.connect_to_sse_server('mcp', 'http://localhost:9003/mcp')
        await client.chat_loop()
    finally:
        await client.cleanup()


if __name__ == "__main__":
    asyncio.run(main())

```

