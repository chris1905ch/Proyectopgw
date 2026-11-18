// Formulario para cambiar la contraseña (perfil del candidato y de la empresa)
const formClave = document.getElementById('form-clave');

if (formClave) {
  formClave.addEventListener('submit', async (e) => {
    e.preventDefault();
    const d = datosForm(formClave);
    if (d.nueva !== d.confirmar) {
      const err = { message: 'Revise los datos ingresados', detalles: { confirmar: 'No coincide con la contraseña nueva' } };
      return mostrarError(formClave, err, '#mensaje-clave');
    }
    try {
      await api('/auth/password', { metodo: 'PUT', cuerpo: { actual: d.actual, nueva: d.nueva } });
      formClave.reset();
      formClave.querySelectorAll('.error-campo').forEach((x) => x.remove());
      mensaje('#mensaje-clave', 'ok', 'La contraseña se actualizó.');
    } catch (err) {
      mostrarError(formClave, err, '#mensaje-clave');
    }
  });
}
