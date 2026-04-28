// Admin screens — my page + admin panel
function MyPage({ me, go }) {
  return (
    <div className="fadein" style={{maxWidth: 960, margin:'0 auto', padding:'28px 40px 64px'}}>
      <div className="mb-5">
        <div className="mono text-[11px] uppercase tracking-[0.18em] mb-1" style={{color:'var(--ink-4)'}}>User-01 · My Page</div>
        <h1 className="text-[24px] font-bold tracking-tight">마이페이지</h1>
      </div>
      <div className="grid gap-5" style={{gridTemplateColumns:'280px 1fr'}}>
        <Card>
          <div className="flex flex-col items-center text-center">
            <Avatar user={me} size={80}/>
            <div className="text-[16px] font-bold mt-3">{me.name}</div>
            <div className="mono text-[11px] mt-1" style={{color:'var(--ink-3)'}}>{me.dept} · {me.rank}</div>
            <Btn variant="outline" icon="camera" size="sm" className="mt-3">사진 변경</Btn>
          </div>
        </Card>
        <Card>
          <SectionLabel>내 정보</SectionLabel>
          <div className="space-y-3">
            {[['사번',me.emp,true],['이름',me.name,false],['이메일',me.name+'@ang.lab',false],['연락처','010-****-1234',false],['생년월일','1998.07.14',false]].map((r,i)=>(
              <div key={i} className="grid items-center gap-4" style={{gridTemplateColumns:'120px 1fr 100px'}}>
                <div className="mono text-[11px] uppercase tracking-wider" style={{color:'var(--ink-3)'}}>{r[0]}</div>
                <Input value={r[1]} onChange={()=>{}}/>
                {r[2] ? <span className="mono text-[10.5px]" style={{color:'var(--ink-4)'}}>관리자만 변경</span> : <Btn variant="ghost" size="sm">변경</Btn>}
              </div>
            ))}
          </div>
          <div className="mt-6 pt-5" style={{borderTop:'1px solid var(--line-2)'}}>
            <SectionLabel>비밀번호 변경</SectionLabel>
            <div className="space-y-3">
              <Input icon="lock" placeholder="현재 비밀번호" type="password"/>
              <Input icon="key" placeholder="새 비밀번호 (6~24자, 영문+특수문자)" type="password"/>
              <Input icon="key" placeholder="새 비밀번호 확인" type="password"/>
            </div>
            <div className="flex justify-end mt-4"><Btn variant="primary" icon="save">변경 저장</Btn></div>
          </div>
        </Card>
      </div>
    </div>
  );
}

function Admin({ me, go }) {
  const [members, setMembers] = useState(USERS.map(u=>({...u, approved: u.id!=='u_jung'})));
  return (
    <div className="fadein" style={{maxWidth: 1360, margin:'0 auto', padding:'28px 40px 64px'}}>
      <div className="mb-5">
        <div className="mono text-[11px] uppercase tracking-[0.18em] mb-1" style={{color:'var(--ink-4)'}}>Admin-01 · Control Panel</div>
        <h1 className="text-[24px] font-bold tracking-tight">관리자</h1>
        <p className="text-[12.5px] mt-1" style={{color:'var(--ink-3)'}}>회원 승인, 직급 수정, 계정 관리</p>
      </div>
      <div className="grid grid-cols-3 gap-4 mb-5">
        {[['전체 회원',members.length,'users'],['승인 대기',members.filter(m=>!m.approved).length,'user-plus'],['활성 회원',members.filter(m=>m.approved).length,'user-check']].map(([l,v,ic],i)=>(
          <Card key={i}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{background:'var(--primary-50)', color:'var(--primary-700)'}}>
                <Icon name={ic} size={18}/>
              </div>
              <div>
                <div className="mono text-[11px] uppercase tracking-wider" style={{color:'var(--ink-3)'}}>{l}</div>
                <div className="text-[22px] font-bold mono">{v}</div>
              </div>
            </div>
          </Card>
        ))}
      </div>
      <Card pad={false}>
        <div className="px-5 py-3 flex items-center justify-between" style={{borderBottom:'1px solid var(--line-2)'}}>
          <span className="mono text-[11px] uppercase tracking-wider font-semibold">회원 관리</span>
          <Input icon="search" placeholder="이름 · 사번 검색" style={{width:240}}/>
        </div>
        <div>
          <div className="grid px-5 py-2.5 mono text-[10.5px] uppercase tracking-wider" style={{gridTemplateColumns:'40px 1fr 100px 120px 100px 120px', background:'#FBFBF7', color:'var(--ink-3)', borderBottom:'1px solid var(--line-2)'}}>
            <div></div><div>이름</div><div>사번</div><div>부서</div><div>권한</div><div>상태</div>
          </div>
          {members.map(u=>(
            <div key={u.id} className="grid items-center px-5 py-3" style={{gridTemplateColumns:'40px 1fr 100px 120px 100px 120px', borderBottom:'1px solid var(--line-2)'}}>
              <Avatar user={u} size={26}/>
              <div className="text-[13px] font-medium">{u.name}</div>
              <div className="mono text-[11.5px]" style={{color:'var(--ink-3)'}}>{u.emp}</div>
              <div className="text-[12px]">{u.dept}</div>
              <Pill tone={u.role==='최고관리자'?'danger':u.role==='팀장'?'primary':'neutral'}>{u.role}</Pill>
              {u.approved ? <Pill tone="good">활성</Pill> : (
                <div className="flex gap-1">
                  <Btn size="sm" variant="primary" icon="check" onClick={()=>setMembers(members.map(m=>m.id===u.id?{...m,approved:true}:m))}>승인</Btn>
                  <Btn size="sm" variant="ghost" icon="x">거절</Btn>
                </div>
              )}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

window.MyPage = MyPage;
window.Admin = Admin;
