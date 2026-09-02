# PyGrid 기본 초기화 스크립트 — 워크북 설정에서 수정할 수 있습니다.
import pandas as pd
import numpy as np

# matplotlib은 처음 사용할 때 자동으로 로드됩니다(부트 시간 절약을 위해 선로드하지 않음).
# 이미 로드된 경우(런타임 재설정 등)에는 여기서 바로 Agg 백엔드를 설정합니다.
# 한글 폰트(Pretendard) 등록은 런타임이 matplotlib 로드 직후 자동으로 처리합니다.
try:
    import matplotlib

    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
except ImportError:
    pass
