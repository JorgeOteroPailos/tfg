package gal.usc.telariabackend.model.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

@Setter
@Getter
public class AiChatMessageRequest {
    @NotBlank
    @Size(max = 2000)
    private String content;

}
