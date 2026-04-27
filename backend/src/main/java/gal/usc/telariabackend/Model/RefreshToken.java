package gal.usc.telariabackend.Model;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "refreshtokens")
public class RefreshToken {

    private String token;

    @Id
    private String useremail;

    public RefreshToken() {}

    public RefreshToken(String token, String useremail) {
        this.token = token;
        this.useremail = useremail;
    }

    public String getToken() {
        return token;
    }

    public String getUseremail() {
        return useremail;
    }
}
