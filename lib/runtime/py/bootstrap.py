# PyGrid 워커 내부 헬퍼 — 부트 시 pyodide.globals에 정의된다.
# 사용자 네임스페이스 오염을 막기 위해 모든 이름은 _pygrid_ 접두사를 쓰고,
# 모듈 import는 함수 안에서만 한다(_pygrid_reset이 접두사 없는 전역을 지우기 때문).


def _pygrid_mpl_setup():
    """matplotlib이 이미 로드된 경우에만 Agg 백엔드·Pretendard 폰트를 적용한다.

    선택한 방식(작업 지침 §3): matplotlib은 부트 시 선로드하지 않는다(지연 로드).
    이 함수는 멱등이며, 워커가 초기화 스크립트 직후와 매 loadPackagesFromImports
    직후에 호출한다 — 사용자가 처음 matplotlib을 import한 시점에 자동 적용된다.
    """
    import sys

    if "matplotlib" not in sys.modules:
        return
    import matplotlib

    matplotlib.use("Agg")
    try:
        import os

        from matplotlib import font_manager

        if os.path.exists("/fonts/Pretendard-Regular.otf"):
            if not any(f.name == "Pretendard" for f in font_manager.fontManager.ttflist):
                font_manager.fontManager.addfont("/fonts/Pretendard-Regular.otf")
            matplotlib.rcParams["font.family"] = "Pretendard"
        matplotlib.rcParams["axes.unicode_minus"] = False
    except Exception:
        pass  # 폰트 실패는 실행을 막지 않는다(차트 한글이 □로 보일 뿐)


def _pygrid_run(code):
    """코드 실행: 본문을 exec하고 마지막 문장이 표현식이면 eval해 repr을 캡처한다.

    반환(JSON 문자열):
      성공 {"ok": true, "repr": str|null, "type": str|null}  (None 결과 → repr null)
      실패 {"ok": false, "etype": 예외 클래스명, "msg": str, "tb": 트레이스백}
    """
    import ast
    import json
    import traceback

    g = globals()
    try:
        tree = ast.parse(code, filename="<pygrid>", mode="exec")
        last = None
        if tree.body and isinstance(tree.body[-1], ast.Expr):
            last = tree.body.pop()
        exec(compile(tree, "<pygrid>", "exec"), g)
        value = None
        if last is not None:
            value = eval(compile(ast.Expression(last.value), "<pygrid>", "eval"), g)
        if value is None:
            return json.dumps({"ok": True, "repr": None, "type": None})
        return json.dumps(
            {"ok": True, "repr": repr(value), "type": type(value).__name__},
            ensure_ascii=False,
        )
    except BaseException as e:  # KeyboardInterrupt(중단)도 실행 실패로 보고한다
        if isinstance(e, SyntaxError):
            tb_text = "".join(traceback.format_exception_only(e))
        else:
            # 이 래퍼 프레임을 지우고 사용자 코드("<pygrid>")부터 보여준다
            tb = e.__traceback__
            while tb is not None and tb.tb_frame.f_code.co_filename != "<pygrid>":
                tb = tb.tb_next
            tb_text = "".join(
                traceback.format_exception(e.with_traceback(tb or e.__traceback__))
            )
        return json.dumps(
            {"ok": False, "etype": type(e).__name__, "msg": str(e), "tb": tb_text},
            ensure_ascii=False,
        )


def _pygrid_inspect():
    """전역 변수 목록(JSON 문자열). 모듈·함수·클래스·언더스코어 이름은 제외."""
    import json
    import types

    out = []
    for name, v in list(globals().items()):
        if name.startswith("_"):
            continue
        if isinstance(
            v, (types.ModuleType, types.FunctionType, types.BuiltinFunctionType, type)
        ):
            continue
        info = {"name": name, "type": type(v).__name__}
        shape = getattr(v, "shape", None)
        if (
            isinstance(shape, tuple)
            and len(shape) == 2
            and all(isinstance(n, int) for n in shape)
        ):
            info["shape"] = list(shape)
        try:
            info["summary"] = repr(v)[:80]
        except Exception:
            info["summary"] = "<repr 실패>"
        out.append(info)
    return json.dumps(out, ensure_ascii=False, default=str)


def _pygrid_reset():
    """사용자 전역을 제거한다(워커 안 best-effort 리셋).

    ponytail: sys.modules에 남은 모듈 상태(예: matplotlib rcParams)는 지우지 못한다.
    완전 초기화가 필요하면 client.ts의 terminateAndReboot(워커 재시작) 경로를 쓴다.
    """
    keep = {
        "__name__",
        "__doc__",
        "__package__",
        "__loader__",
        "__spec__",
        "__builtins__",
        "__annotations__",
    }
    g = globals()
    for name in list(g):
        if name in keep or name.startswith("_pygrid"):
            continue
        del g[name]
