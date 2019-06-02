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

  CodeMirror.registerHelper("hint", "seqdef", function(editor, options) {
    // 返回的hint list将由以下3个列表中的内容组成：
    var actors = options.actors.slice();
    var fragments = [{displayText: "participant declaration", text: "participant ", class: "fragment"},,
                     {displayText: "loop fragment", text: "loop Describing text\nend", class: "fragment"},
                     {displayText: "alt fragment", text: "alt Describing text\nelse \nend", class: "fragment"},
                     {displayText: "opt fragment", text: "opt Describing text\nend", class: "fragment"},
                     {displayText: "note", text: "note left of [Actor]: note text", class: "fragment"}];
    var arrows = ["->>", "-->>", "-x", "--x", "-->"];
    

    var cur = editor.getCursor()
    var curLine = editor.getLine(cur.line);
    var end = cur.ch, start = end;
    var tokenType = editor.getTokenTypeAt(cur);
    var cursorToken = editor.getTokenAt(cur);
    var lineTokens = editor.getLineTokens(cur.line).filter(function(token) { return token.type; });

    // 将指定元素排到列表的首位。
    function moveToFront(array, element) {
      var array = array.slice();
      var index = array.indexOf(element);
      if (index != -1)
        array.splice(index, 1);
      array.unshift(element);
      return array;
    }

    // 从startFrom开始，往上寻找形如"actor-1 ->> actor-2"的语句，并返回这两个actor的文本内容。
    function getPrevInteraction(startFrom, editor) {
      for (var i = startFrom; i >= 0; i--) {
        var tokens = editor.getLineTokens(i).filter(function(token) { return token.type; });
        if (tokens.length >= 3 &&
            tokens[0].type == "actor" &&
            tokens[1].type == "arrow" &&
            tokens[2].type == "actor")
          return [tokens[0].string, tokens[2].string];
      }
      return null;
    }

    // 返回在actors数组中，紧临actor的下一个actor。
    function nextActor(actors, actor) {
      var index = actors.indexOf(actor.trim());
      if (index != -1) {
        if (index + 1 < actors.length)
          return actors[index + 1];
        return actors[0]; // 如果actor已经在数组末尾，则返回数组的第一个actor。
      }
      return actor;
    }

    // 返回一个排序过的actors列表
    function sortActorList(actors, first, second) {
      var list = actors.slice();
      if (second && typeof second == "string")
        list.unshift(second.trim());
      if (first && typeof first == "string")
        list.unshift(first.trim());
      return _.toArray(_.uniq(list));
    }

    // 把Hint List过滤一遍，只留下内容符合用户当前输入内容的。比如：
    // filterHintList(["Client", "Server"], "C") |=> ["Client"]
    function filterHintList(array, matchString) {
      return array.filter(function(elt) {
        if (typeof elt == "string")
          return elt.toLowerCase().indexOf(matchString.toLowerCase()) == 0;
        else if (elt.text) {
          return elt.text.toLowerCase().indexOf(matchString.trim().toLowerCase()) == 0;
        }
        return false; // 如果elt既不是string，也不是符合要求的completion object，直接筛掉。
      });
    }

    function createCompletion(type) {
      if (type == "actor-1" || type == "actor-2") {
        if (cursorToken.type == "actor") start = cursorToken.start;
        var curWord = curLine.slice(start, end);
        var prevInteraction = getPrevInteraction(cur.line - 1, editor);
        if (prevInteraction && type == "actor-2") {
          var list = sortActorList(actors, prevInteraction[0], nextActor(actors, lineTokens[0].string));
        } else if (prevInteraction && type == "actor-1") {
          var list = sortActorList(actors, prevInteraction[1]);
        } else if (lineTokens[0] && type == "actor-2") {
          var list = sortActorList(actors, nextActor(actors, lineTokens[0].string));
        } else {
          var list = actors;
        }
          
        if (type == "actor-1")
          list = list.concat(fragments);
        var suffixText = type == "actor-1" ? " -" : ": ";
        list = filterHintList(list, curWord);
      } else if (type == "arrow") {
        while (start && /[->x]/.test(curLine.charAt(start - 1))) --start;
        var curArraow = curLine.slice(start, end);
        var list = filterHintList(arrows, curArraow);;
        var suffixText = " "
      }
      var completion = {list: list, from: CodeMirror.Pos(cur.line, start), to: CodeMirror.Pos(cur.line, end)};
      CodeMirror.on(completion, "pick", function(pickedValue) {
        if (typeof pickedValue == "string" && type =="actor-1" && lineTokens[0] && lineTokens[0].type == "keyword note") {
          // 当用户在输入note left of [Actor]时，选中补全的actor后，自动选中后面的note text，就像sublime的function补全一样。
          var line = editor.getCursor().line;
          var lineContent = editor.getLine(line);
          editor.setSelection(CodeMirror.Pos(line, lineContent.indexOf("note text")), CodeMirror.Pos(line, lineContent.length));
        } else if (typeof pickedValue == "string") {
          editor.replaceRange(suffixText, editor.getCursor());
        } else if (pickedValue.displayText == "loop fragment" || pickedValue.displayText == "opt fragment") {
          var line = editor.getCursor().line - 1;
          var lineContent = editor.getLine(line);
          editor.setSelection(CodeMirror.Pos(line, lineContent.indexOf("Describing text")), CodeMirror.Pos(line, lineContent.length));
        } else if (pickedValue.displayText == "alt fragment") {
          var line = editor.getCursor().line - 2;
          var lineContent = editor.getLine(line);
          editor.setSelection(CodeMirror.Pos(line, lineContent.indexOf("Describing text")), CodeMirror.Pos(line, lineContent.length));
        } else if (pickedValue.displayText == "note") {
          var line = editor.getCursor().line;
          var lineContent = editor.getLine(line);
          editor.setSelection(CodeMirror.Pos(line, lineContent.indexOf("[Actor]")), CodeMirror.Pos(line, lineContent.indexOf("[Actor]") + 7));
        }
      });
      return completion;
    }

    if (lineTokens.length >= 2 &&
        lineTokens[0].type == "actor" &&
        lineTokens[1].type == "arrow" &&
        (cursorToken.type == "actor" || cursorToken.type == null) &&
        cur.ch > lineTokens[1].end) {
      // 这是要输入actor-2了
      return createCompletion("actor-2");
    } else if ((lineTokens.length >= 2 &&
                lineTokens[0].type == "actor" &&
                lineTokens[1].type == "arrow" &&
               cursorToken.type == "arrow") ||
               (lineTokens.length >= 1 &&
                lineTokens[0].type == "actor" &&
                cursorToken.type == null)) {
      // 这是要输入arrow了
      return createCompletion("arrow");
    } else if ((lineTokens.length > 0 &&
                cursorToken.type == "actor" &&
                lineTokens[0].type !== "keyword participant") ||
               lineTokens.length == 0) {
      // 这是要输入actor-1了
      // console.log("a1");
      return createCompletion("actor-1");
    }
  });
});