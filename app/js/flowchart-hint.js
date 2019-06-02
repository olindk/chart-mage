// CodeMirror, copyright (c) by Marijn Haverbeke and others
// Distributed under an MIT license: http://codemirror.net/LICENSE

(function(mod) {
  if (typeof exports == "object" && typeof module == "object") // CommonJS
    mod(require(".js/codemirror"));
  else if (typeof define == "function" && define.amd) // AMD
    define(["js/codemirror"], mod);
  else // Plain browser env
    mod(CodeMirror);
})(function(CodeMirror) {
  "use strict";

  function getHintBox(startFrom, editor) { // 从startFrom行开始往上找形如"box ->> box"的语句：
    for (var i = startFrom; i >= 0; i--) {
      // var tokens = editor.getLineTokens(i);
      // console.log(tokens);
      // if (_.find(tokens, function(token) { return token.type == "subgraphDeclaration"; })) {
      //   return {type: "subgraphDeclaration"};
      // }
      // 2. 包含2个box的语句，可以认为是"box ->> box"。虽然会有"box box"这样的漏洞，但这个问题已经有syntaxCheck来处理了，这里就不管了。
      var boxes = _.filter(editor.getLineTokens(i), function(token) { return token.type && token.type.indexOf("box") != -1; });
      if (boxes.length == 2)
        return boxes[1];
    }
    return null;
  }

  CodeMirror.registerHelper("hint", "flowchart", function(editor, options) {
    var cur = editor.getCursor();
    var lineTokens = editor.getLineTokens(editor.getCursor().line).filter(function(token) { return token.type; });
    var subgraphCompletion = {displayText: "subgraph declaration", text: "subgraph title\nend", class: "fragment"};

    // 目标是当用户换行时，自动给新的一行插入合适的开头。
    if (/^\s*$/.test(editor.getLine(cur.line))) { // 光标所在行内容为空，意味着很可能是换行了，除非是用户刚刚删除内容：
      if (options.changeObj.from.line == cur.line &&
          options.changeObj.from.ch == cur.ch &&
          options.changeObj.text[0] == "") // 这说明用户真的是删东西删到行首了，那就不再自动插入了。
        return;
      var hintBox = getHintBox(cur.line - 1, editor);
      if (!hintBox) {
        return;
      } else if (hintBox.type == "box decision") {
        editor.replaceRange(hintBox.string + " - No ->> " + "\n" + hintBox.string + " - Yes ->> ", cur);
        var lastLineNumber = editor.getCursor().line - 1;
        editor.setCursor(lastLineNumber, editor.getLine(lastLineNumber).length);
      } else if (hintBox.type.indexOf("box") != -1) {
        editor.replaceRange(hintBox.string + " ->> ", cur);
      }

      // if (_(editor.getLineTokens(cur.line - 1)).some(function(token) { return token.type == "subgraphDeclaration"; }) &&
      //     _(editor.getLineTokens(cur.line + 2)).every(function(token) { return token.type != "endOfSubgraph"; })) {
      //   // if的第一个判断语句句用于判断光标上面那行是否为subgraphDeclaration
      //   // 第二个判断语句是用来hack不知道为啥移动光标会触发change事件的，这只是个临时办法。
      //   editor.replaceRange("\nend", cur);
      //   var lastLineNumber = editor.getCursor().line - 1;
      //   editor.setCursor(lastLineNumber, editor.getLine(lastLineNumber).length);
      // }
    } else if (lineTokens.length == 1) {
      var curWord = lineTokens[0].string;
      if (subgraphCompletion.text.indexOf(curWord) == 0) { // 此时用户正在尝试输入 subgraph
        var completion = {list: [subgraphCompletion], from: CodeMirror.Pos(cur.line, lineTokens[0].start), to: CodeMirror.Pos(cur.line, lineTokens[0].end)};
        CodeMirror.on(completion, "pick", function(pickedValue) {
          var line = editor.getCursor().line - 1;
          var lineContent = editor.getLine(line);
          editor.setSelection(CodeMirror.Pos(line, lineContent.indexOf("title")), CodeMirror.Pos(line, lineContent.length));
        });
        return completion;
      }
    }
  });
});
