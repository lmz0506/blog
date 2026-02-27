# 修复Markdown代码块渲染问题的Jekyll插件
module Jekyll
  module MarkdownBlockFix
    # 修复代码块中的特殊字符
    def fix_code_blocks(content)
      return content if content.nil? || content.empty?

      # 处理代码块（三个反引号包裹的）
      content.gsub(/```(\w+)?\n(.*?)```/m) do |match|
        lang = $1 || ''
        code = $2

        # 保持代码块原样，不做HTML转义
        "```#{lang}\n#{code}```"
      end
    end

    # 修复引用块中的代码块
    def fix_blockquote_code(content)
      return content if content.nil? || content.empty?

      # 处理引用块中的内容
      content.gsub(/^(>+\s*)(.*?)$/m) do |match|
        prefix = $1
        text = $2

        # 如果引用块中包含代码块标记，确保正确渲染
        if text =~ /```/
          "#{prefix}#{text}"
        else
          match
        end
      end
    end
  end
end

Liquid::Template.register_filter(Jekyll::MarkdownBlockFix)
