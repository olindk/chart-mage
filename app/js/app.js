$(function() {
  "use strict";

  $(".splashscreen").remove();
  $(".hidden").removeClass("hidden");

  // *** 弹出框 *** //
  $("#newFlowchart").on($.modal.CLOSE, function(event, modal) {
    $("form.new-chart").trigger("reset");
  })

  $("#newSequenceDiagram").on($.modal.CLOSE, function(event, modal) {
    $("form.new-chart").trigger("reset");
  })

  $(".new-chart").submit(function(event) {
    event.preventDefault();
    controller.newChart(this.getAttribute("data-chart-type"), _.escape(this.name.value));
  });

  $("#show-charts-button").click(function() {
    var allCharts = controller.getAllCharts();

    var htmlText = allCharts.map(function(chart) {
      var trClass = chart.id == controller.currentChart.id ? "select-chart current-chart" : "select-chart";
      var chartLabelClass = chart.type == "flowchart" ? "flowchart-label" : "sequence-diagram-label";
      return "<tr class='" + trClass + "'" + " data-chart-id='" + chart.id + "'>" +
             "<td><p class='" + chartLabelClass + "'>" + chart.type[0].toUpperCase() + "</p></td>" + 
             "<td style='width:100%;'>" + chart.name + "</td>" +
             "<td><a class='rename-chart' href='javascript:void(0);' data-chart-name='" + chart.name + "'>Rename</a></td>" +
             "<td><a class='delete-chart' href='javascript:void(0);' data-chart-name='" + chart.name + "'>Delete</a></td></tr>";
    }).join("");

    $("#chartsList tbody")[0].innerHTML = htmlText;

    $(".select-chart").hover(function() {
      // 显示本行的rename和delete按钮。
      $(this).addClass("active-row");
    }, function() {
      // 隐藏本行的rename和delete按钮。
      $(this).removeClass("active-row");
    });

    $(".select-chart").click(function() {
      controller.openChartByID(this.getAttribute("data-chart-id"));
    });

    $(".delete-chart").click(function(event) {
      event.preventDefault();
      $("#confirm-delete-chart strong").text(this.getAttribute("data-chart-name"));
      $("#cancel-del-button").click(function() { $.modal.close(); });
      $("#confirm-del-button").attr("data-chart-id", this.parentNode.parentNode.getAttribute("data-chart-id"));
      $("#confirm-del-button").click(function() {
        var id = this.getAttribute("data-chart-id")
        controller.deleteChartByID(id);
        if (id != controller.currentChart.id)
          $("#show-charts-button").click();
        else
          window.location.reload();

      });
      $("#confirm-delete-chart").modal({ closeExisting: false });
      return false;
    });

    $(".rename-chart").click(function(event) {
      event.preventDefault();
      $("#rename-chart-modal strong").text(this.getAttribute("data-chart-name"));
      $("#rename-chart-modal form")[0].reset();
      $("#rename-chart-modal form").attr("data-chart-id", this.parentNode.parentNode.getAttribute("data-chart-id"));
      $("#rename-chart-modal").modal({ closeExisting: false });
      return false;
    });

    $("#rename-form").submit(function(event) {
      event.preventDefault();
      controller.renameChartByID(this.getAttribute("data-chart-id"), _.escape(this.name.value));
      $("#show-charts-button").click();
    });

  });

  /*** 两个功能按钮 ***/
  $("#export-diagram").click(function(event) {
    event.preventDefault();

    var svg = $("#graphDiv")[0];
    var svg_xml = (new XMLSerializer).serializeToString(svg);   // extract the data as SVG text
    var data_uri = "data:image/svg+xml;base64," + window.btoa(unescape(encodeURIComponent(svg_xml)));

    var image = new Image;
    image.src = data_uri;
    image.onload = function() {
      var canvas = document.createElement("canvas");
      canvas.width = image.width;
      canvas.height = image.height;

      var context = canvas.getContext("2d");
      context.clearRect(0, 0, image.width, image.height);
      context.fillStyle = "white";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0);

      var a = document.createElement("a");
      a.setAttribute("class", "hidden");
      document.body.appendChild(a);
      a.download = controller.currentChart.name + ".png";
      // a.download = "file.png";
      try {
        a.href = canvas.toDataURL("image/png");
        a.click();
      } catch (error) {
        if (controller.currentChart.type == "flowchart")
          $("#can-not-export-flowchart").modal();
        else if (controller.currentChart.type == "sequenceDiagram")
          $("#can-not-export-seq").modal();
      }
    };
  });

  $("#show-syntax").click(function() {
    if (controller.currentChart.type == "flowchart")
      $("#flowchart-syntax").modal();
    else if (controller.currentChart.type == "sequenceDiagram")
      $("#sequence-diagram-syntax").modal();
  })

  // *** mermaidAPI ***//
  // 这是固定不变的部分，不用纳入MVC的架构里。
  mermaidAPI.initialize({
    startOnLoad: true,
    cloneCssStyles: true,
    flowchart: {
      useMaxWidth: false
    },
    sequenceDiagram:{
      useMaxWidth: false,
      width: 150,
      height: 65,
      actorMargin: 120
    }
  });

  mermaidAPI.parseError = function(err, hash) {
    // console.log(err);
    editorView.markErrorAtLine(hash.line - 1);
  }

  var chart = document.querySelector("#chart");

  function insertSvg(svgCode) {
    chart.innerHTML = svgCode;
  }
  // *** EOF mermaidAPI ***//

  function TranslateError(message, lineNumber) {
    this.message = message;
    this.lineNumber = lineNumber;
    this.stack = (new Error()).stack;
  }
  TranslateError.prototype = Object.create(Error.prototype);
  TranslateError.prototype.name = "TranslateError";

  function ChartNotFoundError(message, id) {
    this.message = message;
    this.id = id;
    this.stack = (new Error()).stack;
  }
  ChartNotFoundError.prototype = Object.create(Error.prototype);
  ChartNotFoundError.prototype.name = "ChartNotFoundError";

  var modal = {
    _sequenceDiagramExample: "participant Alice\nparticipant John\nAlice ->> John: No need to memorize the syntax.\nJohn -->> Alice: You will be hinted during typing.\nNote right of John: Text in note",

    _flowchartExample: "((Terminal)) ->> Process\nProcess ->> Decision?\nDecision? - No ->> Process 1\nDecision? - Yes ->> Process 2\nsubgraph Subgraph Title\n  Process 2 ->> Process 3\nend",

    _charts: JSON.parse(localStorage.getItem("spells")),

    _lastOpenID: localStorage.getItem("lastOpenID"),

    init: function() {
      if (!this._charts || this._charts.length == 0) {
        this._charts = [{"id": uuid.v4(),
                         "type": "sequenceDiagram",
                         "name": "Sample sequence diagram",
                         "content": this._sequenceDiagramExample,
                         "createTime": Date.now(),
                         "lastModified": Date.now()},
                         {"id": uuid.v4(),
                         "type": "flowchart",
                         "direction": "TB",
                         "name": "Sample flowchart",
                         "content": this._flowchartExample,
                         "createTime": Date.now(),
                         "lastModified": Date.now()}];
        localStorage.setItem("spells", JSON.stringify(this._charts));
      }
      var lastOpenID = this._lastOpenID;
      if (!lastOpenID || _(this._charts).find(function(chart) { return chart.id == lastOpenID; }) == undefined) {
        this._lastOpenID = this._charts[0].id;
        if (this._lastOpenID)
          localStorage.setItem("lastOpenID", this._lastOpenID);
        else
          throw new Error("modal._charts maybe contaminated.");
      }
    },

    getChartByID: function(id) {
      var chart = _(this._charts).find(function(chart) { return chart.id == id; });
      if (!chart)
        throw new ChartNotFoundError("Chart not found.", id);
      return chart;
    },

    setChartByID: function(id, content) {
      var chart = _(this._charts).find(function(chart) { return chart.id == id; });
      if (!chart)
        throw new ChartNotFoundError("Chart not found.", id);

      chart.content = content;
      chart.lastModified = Date.now();
      localStorage.setItem("spells", JSON.stringify(this._charts));
    },

    renameChartByID: function(id, name) {
      var chart = _(this._charts).find(function(chart) { return chart.id == id; });
      if (!chart)
        throw new ChartNotFoundError("Chart not found.", id);
      chart.name = name;
      localStorage.setItem("spells", JSON.stringify(this._charts));
    },

    deleteChartByID: function(id, name) {
      // 不用考虑id不存在的异常情况，因为本来就要删掉它。
      this._charts = this._charts.filter(function(chart) { return chart.id != id; });
      localStorage.setItem("spells", JSON.stringify(this._charts));
    },

    getAllCharts: function() {
      return this._charts;
    },

    newChart: function(chartType, name, direction) {
      var chart;
      if (chartType == "sequenceDiagram") {
        chart = {"id": uuid.v4(),
                 "type": "sequenceDiagram",
                 "name": name || "Untitled sequence diagram",
                 "content": this._sequenceDiagramExample,
                 "createTime": Date.now(),
                 "lastModified": Date.now()};
      } else if (chartType == "flowchart") {
        chart = {"id": uuid.v4(),
                 "type": "flowchart",
                 "direction": direction || "TB",
                 "name": name || "Untitled flowchart",
                 "content": this._flowchartExample,
                 "createTime": Date.now(),
                 "lastModified": Date.now()};
      }
      this._charts.unshift(chart);
      localStorage.setItem("spells", JSON.stringify(this._charts));

      return chart.id;
    },

    getLastOpenID: function() {
      if (!this._lastOpenID)
        throw new Error("Can't find modal._lastOpenID.");
      return this._lastOpenID;
    },

    setLastOpenID: function(id) {
      this._lastOpenID = id;
      localStorage.setItem("lastOpenID", this._lastOpenID);
    }
  };

  var editorView = {
    _editor: null,

    _type: null, // Should be "sequenceDiagram" or "flowchart"

    _direction: "TB",

    _translateFlowchart: function() {
      var cm = this._editor;
      var compiled = ''; // compile的结果文本。
      var nodes = []; // 翻译后的nodes，形如['(Start)', 'Talk to customer']，稍后将用于拼接compiled的头部。
      try {
        cm.eachLine(function(lineHandle) {
          var syntaxCheck = ""; // 在这一行翻译完后它应该变成"box arrow box "或"box arrow-end arrow-message arrow-head box "。
          cm.getLineTokens(cm.getLineNumber(lineHandle)).
            filter(function(token) { return token.type != null }).
            forEach(function(token) {
              var tokenString = token.string.trim(); // 它等下就变成被翻译后的文本了
              if (token.type.indexOf("box") != -1) {
                tokenString = tokenString.replace(/"/g, "#quot;");
                syntaxCheck += "box ";
                if (token.type.indexOf("process") != -1)
                  tokenString = '["' + tokenString + '"]';
                else if (token.type.indexOf("decision") != -1)  
                  tokenString = '{"' + tokenString + '"}';
                else if (token.type.indexOf("terminal" != -1))
                  tokenString = '("' + tokenString.slice(2, tokenString.length - 2) + '")';
                if (nodes.indexOf(tokenString) == -1) {
                  nodes.push(tokenString);
                }
                compiled += ('id' + nodes.indexOf(tokenString));
              } else if (token.type == "arrow") {
                syntaxCheck += "arrow ";
                if (tokenString == "->>")
                  tokenString = '-->';
                if (tokenString == "-->>")
                  tokenString = '-.->';
                compiled += tokenString;
              } else if (token.type == "arrow-end" || token.type == "arrow-head") {
                syntaxCheck += token.type + " ";
                switch (tokenString) {
                  case "-":
                    tokenString = '--';
                    break;
                  case "--":
                    tokenString = '-.';
                    break; 
                  case "->>":
                    tokenString = '-->';
                    break;
                  case "-->>":
                    tokenString = '.->';
                    break;
                }
                compiled += tokenString;
              } else { // 剩下的情况就是arrow-message和subgraph了，无需翻译。
                syntaxCheck += token.type + " ";
                compiled += tokenString;
              }
            });
          // 清除之前标记的出错行。
          cm.removeLineClass(cm.getLineNumber(lineHandle), "background", "syntaxError");
          // 如果这行的语法不正确，抛TranslateError。
          if (syntaxCheck != "box " &&
              syntaxCheck != "box arrow box " &&
              syntaxCheck != "box arrow-end arrow-message arrow-head box " &&
              syntaxCheck != "subgraphDeclaration " &&
              syntaxCheck != "endOfSubgraph " &&
              syntaxCheck != "") {
            throw new TranslateError(syntaxCheck, cm.getLineNumber(lineHandle));
          }
          compiled += "\n";
        });
      } catch (error) {
        console.log("Lost in translation at line: " + error.lineNumber);
        if (cm.getCursor().line != error.lineNumber) {
          cm.addLineClass(error.lineNumber, "background", "syntaxError");
        }
        return false;
      }
      nodes.forEach(function(nodeContent) {
        compiled = "id" + nodes.indexOf(nodeContent) + nodeContent + "\n" + compiled;
      })
      return compiled;
    },

    markErrorAtLine: function(lineNumber) {
      if (this._editor.getCursor().line != lineNumber)
        this._editor.addLineClass(lineNumber, "background", "syntaxError");
    },

    _initEditorForSeq: function(content) {
      var actorPattern = /[^\s:\->][^:\->]*/;
      var arrowPattern = /-x|->|-->|->>|--x|-->>/;

      CodeMirror.defineSimpleMode("seqdiagram", {
        start: [
          {regex: /participant/, token: "keyword participant"},
          {regex: /(\s*)(loop|alt|opt)(\s)(.*)/,
           token: [null, "keyword indent", "before-description", "description"],
           indent: true,
           sol: true},
          {regex: /\s*(else)(\s)(.*)/,
           token: ["keyword else", "before-description", "description"],
           sol: true},
          {regex: /(\s*)(note|Note)(\s+)(right of |left of |over )/,
           token: [null, "keyword note", null, "keyword note-direction"],
           sol: true},
          {regex: /(:)(.+)/, token: ["colon", "message"]},
          {regex: /\s*end\s*$/, token: "keyword dedent", dedent: true, sol: true},
          {regex: /(-->>|-->|->>|->|--x|-x)(\s*)(\+|-)/, token: ["arrow", "before-activation", "activation"]},
          {regex: /:/, token: "colon"},
          {regex: arrowPattern, token: "arrow"},
          {regex: actorPattern, token: "actor"}
        ]
      });

      var editor = CodeMirror.fromTextArea(document.getElementById("code"), {
        lineNumbers: true,
        lineWrapping: true,
        viewportMargin: Infinity,
        tabSize: 2,
        indentWithTabs: true,
        mode: "seqdiagram"
      });
      editor.setValue(content);

      /*** 收集全文的actors ***/
      var allActors = [];
      allActors.update = function() {
        this.length = 0;
        var self = this;
        editor.eachLine(function(lineHandle) {
          if (editor.getLineNumber(lineHandle) == editor.getCursor().line) return;
          var validTokens = editor.getLineTokens(editor.getLineNumber(lineHandle)).filter(function(token) { return token.type; });
          // 在如下两种情况下收集actor：
          // 1. 形如 "actor-1 ->> actor-2"
          if (validTokens.length >= 3 && 
              validTokens[0].type == "actor" &&
              validTokens[1].type == "arrow" &&
              validTokens[2].type == "actor") {
            if (self.indexOf(validTokens[0].string.trim()) == -1) self.push(validTokens[0].string.trim());
            if (self.indexOf(validTokens[2].string.trim()) == -1) self.push(validTokens[2].string.trim());
          }
          // 2. 形如 "participant actor"
          else if (validTokens.length == 2 &&
                   validTokens[0].type.indexOf("participant") != -1 &&
                   validTokens[1].type == "actor") {
            if (self.indexOf(validTokens[1].string.trim()) == -1) self.push(validTokens[1].string.trim());
          }
        });
      }
      allActors.update();

      editor.on("beforeChange", function(cm, changeObj) {
        // 除非用户只是在输入message，否则全盘updateActors()
        if (changeObj.from.line == changeObj.to.line && cm.getTokenTypeAt(changeObj.from) == "message")
          return;
        allActors.update();
      });
      // *** End *** //

      var timeout; // 用于防止频繁渲染，当用户停止输入超过500毫秒，才调用drawDiagram()。
      var self = this;
      editor.on("change", function(cm, changeObj) {
        clearTimeout(timeout);
        timeout = setTimeout(function() {
          self.renderChart();
        }, 500);
        controller.setChartContent(cm.getValue());
        cm.showHint({hint: CodeMirror.hint.seqdef,
                     completeSingle: false,
                     actors: allActors});
      });

      this._editor = editor;
    },

    _initEditorForFlowchart: function(content) {
      var arrowPattern = /->>|-->>/;
      var arrowEndPattern = /-\s|--\s/;
      var arrowMessagePattern = /[^\s:\->][^:\->]*/;
      var arrowHeadPattern = /\s->>|\s-->>/;
      var arrowWithMessagePattern = new RegExp("(" + arrowEndPattern.source + ")" +
                                               "(" + arrowMessagePattern.source + ")" +
                                               "(" + arrowHeadPattern.source + ")");
      var terminalPattern = /\(\([^\s\->].*?\)\)/;
      var decisionPattern = /[^\s\->].*?(\?|\？)/;
      var processPattern = /[^\(\s\->][^\?\？]*?/;
      var processPatternGreedy = /[^\(\s\->][^\?\？]*/;
      var processArrowPattern = new RegExp("(" + processPattern.source + ")" + "(" + arrowPattern.source + ")");
      var processArrowWithMessagePattern = new RegExp("(" + processPattern.source + ")" + arrowWithMessagePattern.source);
      
      CodeMirror.defineSimpleMode("flowchart", {
        start: [
          {regex: /\s*subgraph\s+[^\{\}\(\)]+$/, token: "subgraphDeclaration", sol: true, indent: true},
          {regex: /\s*end$/, token: "endOfSubgraph", sol: true, dedent: true},
          {regex: processArrowWithMessagePattern, token: ["box process", "arrow-end", "arrow-message", "arrow-head"]},
          {regex: processArrowPattern, token: ["box process", "arrow"]},
          {regex: terminalPattern, token: "box terminal"},
          {regex: decisionPattern, token: "box decision"},
          {regex: processPatternGreedy, token: "box process"},
          {regex: arrowPattern, token: "arrow"},
          {regex: arrowWithMessagePattern, token: ["arrow-end", "arrow-message", "arrow-head"]}
        ]
      });

      var editor = CodeMirror.fromTextArea(document.getElementById("code"), {
        lineNumbers: true,
        lineWrapping: true,
        viewportMargin: Infinity,
        tabSize: 2,
        indentWithTabs: true,
        mode: "flowchart"
      });
      editor.setValue(content);

      var timeout; // 用于防止频繁渲染，当用户停止输入超过500毫秒，才调用drawDiagram()。
      var self = this;
      editor.on("change", function(cm, changeObj) {
        timeout = setTimeout(function() {
          self.renderChart();
        }, 500);
        controller.setChartContent(cm.getValue());
        cm.showHint({hint: CodeMirror.hint.flowchart,
                     completeSingle: false,
                     changeObj: changeObj});
      });

      this._editor = editor;
    },

    init: function(type, content) {
      this._type = type;
      if (type == "sequenceDiagram")
        this._initEditorForSeq(content); 
      else if (type == "flowchart")
        this._initEditorForFlowchart(content);
      this.renderChart();
    },

    _mermaidDraw: function(diagramDefinition) {
      if (mermaidAPI.parse(diagramDefinition)) {
        var self = this;
        self._editor.eachLine(function(lineHandle) {
          self._editor.removeLineClass(self._editor.getLineNumber(lineHandle), "background", "syntaxError");
        });
        var svg;
        if (svg = document.querySelector(".chart svg"))
          chart.removeChild(svg);
        mermaidAPI.render('graphDiv', diagramDefinition, insertSvg);
      }
    },

    renderChart: function() {
      if (this._type == "sequenceDiagram")
        this._mermaidDraw("sequenceDiagram\n" + this._editor.getValue());
      else if (this._type == "flowchart") {
        var compiled = this._translateFlowchart(this._editor);
        if (compiled && this._direction == "LR") {
          this._mermaidDraw("graph LR\n" + compiled);
        } else if (compiled) {
          this._mermaidDraw("graph TB\n" + compiled);
        }
      }
    }
  }

  var controller = {
    currentChart: null,

    init: function() {
      modal.init();
      this.currentChart = modal.getChartByID(modal.getLastOpenID());
      editorView.init(this.currentChart.type, this.currentChart.content);
    },

    setChartContent: function(content) {
      try {
        modal.setChartByID(this.currentChart.id, content);
      } catch (e) {
        if (e instanceof ChartNotFoundError)
          $("#chart-not-found").modal();
      }
    },

    newChart: function(type, name, direction) {
      modal.setLastOpenID(modal.newChart(type, name, direction)); // 创建新chart 并 更新lastOpenID
      window.location.reload();
    },

    getAllCharts: function() {
      return _.toArray(_(modal.getAllCharts()).sortBy(function(chart) { return -chart.lastModified; }));
    },

    openChartByID: function(id) {
      try {
        modal.setLastOpenID(id);
        window.location.reload();
      } catch (e) {
        if (e instanceof ChartNotFoundError)
          $("#chart-not-found").modal();
      }
    },

    renameChartByID: function(id, name) {
      try {
        modal.renameChartByID(id, name);
      } catch (e) {
        if (e instanceof ChartNotFoundError)
          $("#chart-not-found").modal();
      }
    },

    deleteChartByID: function(id) {
      try {
        modal.deleteChartByID(id);
      } catch (e) {
        if (e instanceof ChartNotFoundError)
          $("#chart-not-found").modal();
      }
    }
  };

  controller.init();

  window.debug = function(cmd) {
    if (cmd == "on") {
      window.controller = controller;
      window.modal = modal;
    } else {
      window.controller = null;
      window.modal = null;
    }
  };
})