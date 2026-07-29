// ═══════════════ 深链处理 ═══════════════

function handleDeepLink() {
  var p = new URLSearchParams(location.search);
  var dep = p.get('dep'), arr = p.get('arr'), nights = p.get('nights');
  var date = p.get('date'), flight = p.get('flight');
  var retFlight = p.get('ret_flight'), retDate = p.get('ret_date');
  
  if (dep && arr && date && flight) {
    // 精确到某一航班日期
    var rec = DB.records.find(function(r) {
      return r.dep === dep && r.arr === arr && r.dep_date === date && r.flight === flight;
    });
    if (rec) {
      setTimeout(function() {
        openDetail(rec);
        // 如果有回程组合参数，等详情渲染后自动选择
        if (retFlight && retDate) {
          setTimeout(function() {
            var rets = getReturnOptions(rec);
            var idx = -1;
            for (var i = 0; i < rets.length; i++) {
              if (rets[i].flight === retFlight && rets[i].dep_date === retDate) { idx = i; break; }
            }
            if (idx >= 0) selectReturn(idx);
          }, 200);
        }
      }, 300);
    }
  } else if (dep && arr) {
    // 按路线筛选
    setTimeout(function() { showRouteDetail(dep, arr, nights); }, 300);
  }
}

