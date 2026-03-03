import React, { useEffect, useState } from 'react';
import styled from 'styled-components';
import { getMe, updateMe, uploadProfilePhotoMe } from '../../services/api';
import AppHeader from '../../components/AppHeader';

const FullPage = styled.div`
  background: #ffffff;
  min-height: 100vh;
  width: 100%;
  color: #222;
`;


const Container = styled.div`
  max-width: 900px;
  margin: 24px auto;
  padding: 0 24px 40px;
`;

const Card = styled.div`
  background:#fff;
  padding:28px;
  border-radius:10px;
  box-shadow: 0 8px 30px rgba(0,0,0,0.06);
  text-align:center;
  display:flex;
  flex-direction:column;
  align-items:center;
`;

const Avatar = styled.div`
  width:120px;
  height:120px;
  border-radius:50%;
  margin: 0 auto 12px auto;
  background: #ffd966;
  display:flex;
  align-items:center;
  justify-content:center;
  font-weight:700;
  color:#fff;
  background-size:cover;
  background-position:center;
`;

const Name = styled.h2`
  margin:6px 0 8px 0;
  font-size:20px;
`;

const Row = styled.div`
  display:flex;
  justify-content:space-between;
  gap:16px;
  width:100%;
  margin:8px 0;
`;

const Col = styled.div`
  flex:1;
  text-align:center;
`;

const Label = styled.div`
  color:#777;
  font-size:12px;
`;

const Value = styled.div`
  font-weight:700;
  margin-top:6px;
`;

const EditButton = styled.button`
  background:#28a745;
  color:#fff;
  border:none;
  padding:12px 28px;
  border-radius:18px;
  cursor:pointer;
  font-weight:700;
  margin-top:18px;
`;

const Input = styled.input`
  width:100%;
  padding:8px 10px;
  border-radius:8px;
  border:1px solid #ddd;
`;

export default function UserProfile(){
  const [user, setUser] = useState(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ username:'', frcTeamNumber:'', rookieYear:'', profilePhoto:'' });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchUser();
  }, []);

  async function fetchUser(){
    setLoading(true);
    try{
      const u = await getMe();
      setUser(u);
      setForm({
        username: u.username || '',
        frcTeamNumber: u.frcTeamNumber || '',
        rookieYear: u.rookieYear || '',
        profilePhoto: u.profilePhoto || ''
      });
    }catch(e){
      console.error(e);
      alert('Erro ao buscar perfil — verifique se está autenticado');
    }finally{
      setLoading(false);
    }
  }

  async function handleSave(){
    if (!user?.id && !user?._id) return;
    setLoading(true);
    try{
      const payload = {
        username: form.username,
        frcTeamNumber: form.frcTeamNumber ? Number(form.frcTeamNumber) : undefined,
        rookieYear: form.rookieYear ? Number(form.rookieYear) : undefined,
        profilePhoto: form.profilePhoto || undefined
      };
      const updated = await updateMe(payload);
      setUser(updated);
      setEditing(false);
    }catch(e){
      console.error(e);
      alert('Erro ao salvar perfil');
    }finally{
      setLoading(false);
    }
  }

  async function handleFileChange(e){
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    if (!user?.id && !user?._id) return alert('Usuário não identificado');
    setLoading(true);
    try{
      const resp = await uploadProfilePhotoMe(f);
      // server returns url and updated user
      if (resp?.url) {
        setForm({...form, profilePhoto: resp.url});
        setUser(resp.user || {...user, profilePhoto: resp.url});
      }
    }catch(err){
      console.error(err);
      alert('Erro ao enviar imagem');
    }finally{
      setLoading(false);
    }
  }

  if (loading && !user) return (
    <FullPage>
      <Container><p>Carregando...</p></Container>
    </FullPage>
  );

  return (
    <FullPage>
      <AppHeader
        title="FANTASY - FRC"
        titleTo="/dashboard"
        rightText="SEU PERFIL"
        maxWidth={1200}
      />

      <Container>
        <Card>
          <Avatar style={ user?.profilePhoto ? { backgroundImage: `url(${user.profilePhoto})` } : {} }>
            {!user?.profilePhoto && (user?.username ? user.username.split(' ').map(n=>n[0]).slice(0,2).join('').toUpperCase() : 'U')}
          </Avatar>

          {!editing ? (
            <>
              <Name>{user?.username || 'Usuário'}</Name>

              <Row>
                <Col>
                  <Label>PATRIMÔNIO</Label>
                  <Value>{user?.patrimonio?.toFixed ? `${user.patrimonio.toFixed(2)} ◈` : `${user?.patrimonio ?? '---'} ◈`}</Value>
                </Col>
                <Col>
                  <Label>PONTUAÇÃO TOTAL</Label>
                  <Value>{user?.totalPointsSeason ?? '---'}</Value>
                </Col>
              </Row>

              <Row>
                <Col>
                  <Label>ANO ROOKIE</Label>
                  <Value>{user?.rookieYear ?? '---'}</Value>
                </Col>
                <Col>
                  <Label>TEAM NUMBER</Label>
                  <Value>#{user?.frcTeamNumber ?? '---'}</Value>
                </Col>
              </Row>

              <EditButton onClick={() => setEditing(true)}>EDITAR</EditButton>
            </>
          ) : (
            <>
              <div style={{width:'100%', textAlign:'left'}}>
                <Label>Foto de Perfil (upload)</Label>
                <input type="file" accept="image/*" onChange={handleFileChange} />
              </div>

              <div style={{width:'100%', textAlign:'left', marginTop:10}}>
                <Label>Nome de usuário</Label>
                <Input value={form.username} onChange={e=>setForm({...form, username: e.target.value})} />
              </div>

              <Row>
                <Col style={{textAlign:'left'}}>
                  <Label>Numero da equipe</Label>
                  <Input value={form.frcTeamNumber} onChange={e=>setForm({...form, frcTeamNumber: e.target.value})} />
                </Col>
                <Col style={{textAlign:'left'}}>
                  <Label>Ano Rookie</Label>
                  <Input value={form.rookieYear} onChange={e=>setForm({...form, rookieYear: e.target.value})} />
                </Col>
              </Row>

              <div style={{display:'flex', gap:10, justifyContent:'center', marginTop:14}}>
                <EditButton onClick={handleSave}>{loading ? 'SALVANDO...' : 'SALVAR'}</EditButton>
                <EditButton style={{background:'#6c757d'}} onClick={()=>setEditing(false)}>CANCELAR</EditButton>
              </div>
            </>
          )}

        </Card>
      </Container>
    </FullPage>
  );
}
