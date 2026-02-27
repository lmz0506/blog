# Blockquote Line Break Fixer Plugin
# 自动处理引用块中的换行问题
# 在引用块中的连续非空行末尾自动添加两个空格，以便 Kramdown 识别为换行

Jekyll::Hooks.register [:documents, :pages], :pre_render do |document|
  # 只处理 markdown 文档
  if document.extname == '.md' || document.path&.end_with?('.md')
    content = document.content
    lines = content.split("\n")
    processed_lines = []

    lines.each_with_index do |line, i|
      # 匹配引用块行：> 开头
      if line =~ /^(>\s*)(.*)$/
        prefix = $1  # 引用标记（> 或 > + 空格）
        text = $2    # 实际内容

        # 检查下一行是否也是引用块
        next_line = lines[i + 1]

        if next_line && next_line =~ /^>\s*(.+)$/
          # 下一行也是引用块且有内容
          next_content = $1

          # 当前行有内容，且下一行也有内容（不是空行）
          if !text.strip.empty? && !next_content.strip.empty?
            # 如果当前行末尾没有两个空格，则添加
            unless text.end_with?('  ')
              line = "#{prefix}#{text.rstrip}  "
            end
          end
        end

        processed_lines << line
      else
        # 非引用块行，直接保留
        processed_lines << line
      end
    end

    document.content = processed_lines.join("\n")
  end
end
