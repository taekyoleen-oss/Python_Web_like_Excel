// Python 예외 → 초보자용 한국어 요약 (설계서 §1.6: 상위 10종 패턴 매핑)

const MESSAGES: Record<string, string> = {
  NameError:
    "정의되지 않은 이름을 사용했습니다. 변수 이름의 오타나 실행 순서를 확인하세요.",
  KeyError:
    "존재하지 않는 키(열 이름)를 참조했습니다. 열 이름 철자와 헤더 여부(headers=True)를 확인하세요.",
  ValueError:
    "값의 형식이 올바르지 않습니다. 숫자·날짜 변환 대상 데이터에 문자가 섞였는지 확인하세요.",
  TypeError:
    "타입이 맞지 않는 연산입니다. 문자열과 숫자를 섞어 계산하고 있지 않은지 확인하세요.",
  IndexError:
    "범위를 벗어난 위치를 참조했습니다. 행/열 개수보다 큰 인덱스를 쓰지 않았는지 확인하세요.",
  AttributeError:
    "해당 객체에 없는 속성·메서드를 호출했습니다. 메서드 이름의 오타를 확인하세요.",
  SyntaxError:
    "문법 오류입니다. 괄호·따옴표·콜론(:)이 짝을 이루는지 확인하세요.",
  IndentationError:
    "들여쓰기 오류입니다. 공백 개수를 일정하게 맞추세요.",
  ZeroDivisionError: "0으로 나눌 수 없습니다. 분모가 0이 되는 행이 있는지 확인하세요.",
  ModuleNotFoundError:
    "설치되지 않은 패키지입니다. v1은 numpy·pandas·matplotlib·scipy·statsmodels·scikit-learn·seaborn만 지원합니다.",
  KeyboardInterrupt: "실행이 중단되었습니다.",
};

/** 예외 클래스명 → 한국어 요약. 매핑에 없으면 원문 메시지를 그대로 쓴다 */
export function summarizeErrorKo(errorType: string, message: string): string {
  const base = MESSAGES[errorType];
  return base ? `${errorType}: ${base}` : `${errorType}: ${message}`;
}
